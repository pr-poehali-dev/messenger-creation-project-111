"""
Генерация VAPID ключей для Web Push.
GET / — сгенерировать и вернуть пару ключей
"""
import json
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.backends import default_backend
import base64

CORS = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'}

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode()

def handler(event: dict, context) -> dict:
    """Генерирует VAPID ключи (только для первоначальной настройки)"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
    public_key = private_key.public_key()

    private_bytes = private_key.private_numbers().private_value.to_bytes(32, 'big')
    pub = public_key.public_numbers()
    public_bytes = b'\x04' + pub.x.to_bytes(32, 'big') + pub.y.to_bytes(32, 'big')

    return {
        'statusCode': 200,
        'headers': CORS,
        'body': json.dumps({
            'vapid_public_key': b64url(public_bytes),
            'vapid_private_key': b64url(private_bytes),
        })
    }
