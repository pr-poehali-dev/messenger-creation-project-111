"""
Загрузка файлов и изображений в S3. v2
POST / — загрузить файл (base64 в теле), вернуть CDN URL
"""
import json
import os
import base64
import mimetypes
import secrets
import psycopg2
import boto3

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p31400750_messenger_creation_p')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}

ALLOWED_MIME = {
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/zip', 'application/x-zip-compressed',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
}
MAX_SIZE_BYTES = 4 * 1024 * 1024  # 4 MB (base64 overhead ~33%, stays under 6MB request limit)


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def get_session_user_id(session_id: str, conn):
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT user_id FROM {SCHEMA}.sessions WHERE id = %s AND expires_at > NOW()",
            (session_id,)
        )
        row = cur.fetchone()
    return row[0] if row else None


def get_s3():
    return boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': CORS, 'body': json.dumps({'error': 'Method not allowed'})}

    headers = event.get('headers') or {}
    session_id = headers.get('X-Session-Id', '')

    conn = get_conn()
    try:
        user_id = get_session_user_id(session_id, conn)
        if not user_id:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        body = json.loads(event.get('body') or '{}')
        file_name = body.get('file_name', 'file')
        file_data_b64 = body.get('file_data', '')
        mime_type = body.get('mime_type', 'application/octet-stream')

        if not file_data_b64:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Нет данных файла'})}

        if mime_type not in ALLOWED_MIME:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Тип файла не поддерживается'})}

        file_bytes = base64.b64decode(file_data_b64)
        if len(file_bytes) > MAX_SIZE_BYTES:
            return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Файл слишком большой (макс. 10 МБ)'})}

        ext = mimetypes.guess_extension(mime_type) or ''
        if ext == '.jpe':
            ext = '.jpg'
        token = secrets.token_hex(16)
        key = f"messenger/{user_id}/{token}{ext}"

        s3 = get_s3()
        s3.put_object(
            Bucket='files',
            Key=key,
            Body=file_bytes,
            ContentType=mime_type,
        )

        access_key = os.environ['AWS_ACCESS_KEY_ID']
        cdn_url = f"https://cdn.poehali.dev/projects/{access_key}/bucket/{key}"

        is_image = mime_type.startswith('image/')

        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
            'url': cdn_url,
            'file_name': file_name,
            'mime_type': mime_type,
            'is_image': is_image,
            'size': len(file_bytes),
        })}
    finally:
        conn.close()