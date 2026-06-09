"""
Web Push уведомления.
POST ?action=subscribe   — сохранить push-подписку браузера
POST ?action=unsubscribe — удалить подписку
POST ?action=send        — отправить push конкретному user_id (внутренний вызов)
GET  ?action=vapid-key   — вернуть публичный VAPID ключ
"""
import json
import os
import time
import base64
import hashlib
import hmac
import struct
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend
import psycopg2
import urllib.request
import urllib.error

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p31400750_messenger_creation_p')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_user(session_id, conn):
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT user_id FROM {SCHEMA}.sessions WHERE id = %s AND expires_at > NOW()",
            (session_id,)
        )
        row = cur.fetchone()
    return row[0] if row else None


def b64url_decode(s: str) -> bytes:
    s += '=' * (-len(s) % 4)
    return base64.urlsafe_b64decode(s)


def b64url_encode(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b'=').decode()


def make_vapid_token(endpoint: str) -> str:
    """Создаёт JWT токен для VAPID авторизации"""
    private_key_bytes = b64url_decode(os.environ['VAPID_PRIVATE_KEY'])
    private_value = int.from_bytes(private_key_bytes, 'big')
    private_key = ec.derive_private_key(private_value, ec.SECP256R1(), default_backend())

    from urllib.parse import urlparse
    parsed = urlparse(endpoint)
    audience = f"{parsed.scheme}://{parsed.netloc}"

    header = b64url_encode(json.dumps({'typ': 'JWT', 'alg': 'ES256'}).encode())
    payload = b64url_encode(json.dumps({
        'aud': audience,
        'exp': int(time.time()) + 43200,
        'sub': 'mailto:push@pulse.app',
    }).encode())

    signing_input = f"{header}.{payload}".encode()
    signature = private_key.sign(signing_input, ec.ECDSA(hashes.SHA256()))

    # DER → r+s (64 bytes)
    from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
    r, s = decode_dss_signature(signature)
    sig_bytes = r.to_bytes(32, 'big') + s.to_bytes(32, 'big')

    return f"{header}.{payload}.{b64url_encode(sig_bytes)}"


def encrypt_payload(subscription: dict, payload: str) -> tuple:
    """Шифрует payload по стандарту RFC 8291 (aesgcm)"""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF

    user_public_key = b64url_decode(subscription['keys']['p256dh'])
    user_auth = b64url_decode(subscription['keys']['auth'])

    # Генерируем ephemeral ключ
    ephemeral_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
    ephemeral_pub = ephemeral_key.public_key()
    ephemeral_pub_bytes = b'\x04' + \
        ephemeral_key.private_numbers().public_numbers.x.to_bytes(32, 'big') + \
        ephemeral_key.private_numbers().public_numbers.y.to_bytes(32, 'big')

    # Восстанавливаем публичный ключ пользователя
    x = int.from_bytes(user_public_key[1:33], 'big')
    y = int.from_bytes(user_public_key[33:], 'big')
    user_pub = ec.EllipticCurvePublicNumbers(x, y, ec.SECP256R1()).public_key(default_backend())

    # ECDH shared secret
    shared_secret = ephemeral_key.exchange(ec.ECDH(), user_pub)

    # HKDF для получения ключей
    salt = os.urandom(16)

    # PRK через auth secret
    prk = HKDF(
        algorithm=hashes.SHA256(), length=32,
        salt=user_auth, info=b'Content-Encoding: auth\x00',
        backend=default_backend()
    ).derive(shared_secret)

    # Контекст для ключа и nonce
    context = b'P-256\x00' + \
        struct.pack('>H', len(user_public_key)) + user_public_key + \
        struct.pack('>H', len(ephemeral_pub_bytes)) + ephemeral_pub_bytes

    cek = HKDF(
        algorithm=hashes.SHA256(), length=16,
        salt=salt, info=b'Content-Encoding: aesgcm\x00' + context,
        backend=default_backend()
    ).derive(prk)

    nonce = HKDF(
        algorithm=hashes.SHA256(), length=12,
        salt=salt, info=b'Content-Encoding: nonce\x00' + context,
        backend=default_backend()
    ).derive(prk)

    # Шифрование
    padded = b'\x00\x00' + payload.encode()
    encrypted = AESGCM(cek).encrypt(nonce, padded, None)

    return salt, ephemeral_pub_bytes, encrypted


def send_web_push(subscription: dict, title: str, body: str, data: dict = None):
    """Отправляет Web Push уведомление"""
    endpoint = subscription['endpoint']
    payload = json.dumps({'title': title, 'body': body, 'data': data or {}})

    salt, server_pub, ciphertext = encrypt_payload(subscription, payload)
    vapid_token = make_vapid_token(endpoint)
    vapid_pub = os.environ['VAPID_PUBLIC_KEY']

    headers = {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aesgcm',
        'Encryption': f'salt={b64url_encode(salt)}',
        'Crypto-Key': f'dh={b64url_encode(server_pub)};p256ecdsa={vapid_pub}',
        'Authorization': f'WebPush {vapid_token}',
        'TTL': '86400',
        'Content-Length': str(len(ciphertext)),
    }

    req = urllib.request.Request(endpoint, data=ciphertext, headers=headers, method='POST')
    try:
        urllib.request.urlopen(req, timeout=10)
        return True
    except urllib.error.HTTPError as e:
        if e.code == 410:
            return 'gone'
        return False
    except Exception:
        return False


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    headers = event.get('headers') or {}
    session_id = headers.get('X-Session-Id', '')

    # Публичный VAPID ключ — без авторизации
    if method == 'GET' and action == 'vapid-key':
        return {
            'statusCode': 200, 'headers': CORS,
            'body': json.dumps({'vapid_public_key': os.environ.get('VAPID_PUBLIC_KEY', '')})
        }

    # Сохранить подписку
    if method == 'POST' and action == 'subscribe':
        conn = get_conn()
        try:
            user_id = get_user(session_id, conn)
            if not user_id:
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

            body = json.loads(event.get('body') or '{}')
            endpoint = body.get('endpoint', '')
            p256dh = body.get('keys', {}).get('p256dh', '')
            auth = body.get('keys', {}).get('auth', '')

            if not endpoint or not p256dh or not auth:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверные данные подписки'})}

            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.push_subscriptions (user_id, endpoint, p256dh, auth) "
                    f"VALUES (%s, %s, %s, %s) ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh=%s, auth=%s",
                    (user_id, endpoint, p256dh, auth, p256dh, auth)
                )
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}
        finally:
            conn.close()

    # Отправить push конкретному пользователю (внутренний вызов)
    if method == 'POST' and action == 'send':
        body = json.loads(event.get('body') or '{}')
        to_user_id = body.get('user_id')
        title = body.get('title', 'PULSE')
        msg_body = body.get('body', 'Новое сообщение')
        data = body.get('data', {})

        if not to_user_id:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'user_id required'})}

        conn = get_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, endpoint, p256dh, auth FROM {SCHEMA}.push_subscriptions WHERE user_id = %s",
                    (to_user_id,)
                )
                rows = cur.fetchall()

            gone_ids = []
            sent = 0
            for row in rows:
                sid, endpoint, p256dh, auth = row
                sub = {'endpoint': endpoint, 'keys': {'p256dh': p256dh, 'auth': auth}}
                result = send_web_push(sub, title, msg_body, data)
                if result == 'gone':
                    gone_ids.append(sid)
                elif result:
                    sent += 1

            # Удаляем невалидные подписки
            if gone_ids:
                with conn.cursor() as cur:
                    cur.execute(f"DELETE FROM {SCHEMA}.push_subscriptions WHERE id = ANY(%s)", (gone_ids,))
                conn.commit()

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'sent': sent})}
        finally:
            conn.close()

    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Not found'})}
