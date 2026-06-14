"""
Web Push уведомления через pywebpush.
POST ?action=subscribe   — сохранить push-подписку браузера
POST ?action=unsubscribe — удалить подписку
POST ?action=send        — отправить push конкретному user_id (внутренний вызов)
GET  ?action=vapid-key   — вернуть публичный VAPID ключ
"""
import json
import os
import psycopg2
from pywebpush import webpush, WebPushException

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


def send_web_push(endpoint: str, p256dh: str, auth: str, title: str, body: str, data: dict) -> str:
    """Отправляет Web Push через pywebpush. Возвращает 'ok', 'gone' или 'error:...'"""
    try:
        webpush(
            subscription_info={
                'endpoint': endpoint,
                'keys': {'p256dh': p256dh, 'auth': auth},
            },
            data=json.dumps({'title': title, 'body': body, 'data': data}),
            vapid_private_key=os.environ['VAPID_PRIVATE_KEY'],
            vapid_claims={
                'sub': 'mailto:push@pulse.app',
            },
        )
        return 'ok'
    except WebPushException as e:
        if e.response is not None and e.response.status_code == 410:
            return 'gone'
        print(f"WebPushException: {e}, response: {e.response.text if e.response else 'no response'}")
        return f'error:{e}'
    except Exception as e:
        print(f"Push error: {e}")
        return f'error:{e}'


def handler(event: dict, context) -> dict:
    """Web Push уведомления: подписка, отписка, отправка."""
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

            body_data = json.loads(event.get('body') or '{}')
            endpoint = body_data.get('endpoint', '')
            p256dh = body_data.get('keys', {}).get('p256dh', '')
            auth = body_data.get('keys', {}).get('auth', '')

            if not endpoint or not p256dh or not auth:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверные данные подписки'})}

            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.push_subscriptions (user_id, endpoint, p256dh, auth) "
                    f"VALUES (%s, %s, %s, %s) ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh=%s, auth=%s",
                    (user_id, endpoint, p256dh, auth, p256dh, auth)
                )
            conn.commit()
            print(f"Push subscribed: user={user_id}, endpoint={endpoint[:60]}")
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}
        finally:
            conn.close()

    # Отправить push конкретному пользователю (внутренний вызов)
    if method == 'POST' and action == 'send':
        body_data = json.loads(event.get('body') or '{}')
        to_user_id = body_data.get('user_id')
        title = body_data.get('title', 'PULSE')
        msg_body = body_data.get('body', 'Новое сообщение')
        data = body_data.get('data', {})

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

            print(f"Sending push to user={to_user_id}, subscriptions={len(rows)}")

            gone_ids = []
            sent = 0
            for row in rows:
                sid, endpoint, p256dh, auth = row
                result = send_web_push(endpoint, p256dh, auth, title, msg_body, data)
                print(f"Push result for sub={sid}: {result}")
                if result == 'gone':
                    gone_ids.append(sid)
                elif result == 'ok':
                    sent += 1

            if gone_ids:
                with conn.cursor() as cur:
                    cur.execute(
                        f"DELETE FROM {SCHEMA}.push_subscriptions WHERE id = ANY(%s)",
                        (gone_ids,)
                    )
                conn.commit()

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'sent': sent, 'total': len(rows)})}
        finally:
            conn.close()

    # Удалить подписку
    if method == 'POST' and action == 'unsubscribe':
        conn = get_conn()
        try:
            user_id = get_user(session_id, conn)
            if not user_id:
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}
            with conn.cursor() as cur:
                cur.execute(f"DELETE FROM {SCHEMA}.push_subscriptions WHERE user_id = %s", (user_id,))
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}
        finally:
            conn.close()

    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Not found'})}
