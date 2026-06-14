"""
Лёгкий endpoint проверки обновлений.
GET / — вернуть версии (chat_version, message_version, chat_id) для текущего пользователя.
Клиент сравнивает с предыдущим ответом и вызывает тяжёлые запросы только при изменении.
"""
import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p31400750_messenger_creation_p')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def handler(event: dict, context) -> dict:
    """Проверяет наличие обновлений для пользователя — чаты и сообщения."""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    headers = event.get('headers') or {}
    session_id = headers.get('X-Session-Id', '')
    params = event.get('queryStringParameters') or {}
    chat_id = params.get('chat_id')

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            # Авторизация
            cur.execute(
                f"SELECT user_id FROM {SCHEMA}.sessions WHERE id = %s AND expires_at > NOW()",
                (session_id,)
            )
            row = cur.fetchone()
            if not row:
                return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}
            user_id = row[0]

            # Версия чатов: MAX id последнего сообщения + непрочитанные + онлайн-статусы собеседников
            cur.execute(f"""
                SELECT
                    COALESCE(MAX(m.id), 0) as last_msg_id,
                    COALESCE(SUM(
                        CASE WHEN m2.id IS NOT NULL AND m2.sender_id != %s
                             AND NOT EXISTS (
                                 SELECT 1 FROM {SCHEMA}.message_reads mr
                                 WHERE mr.message_id = m2.id AND mr.user_id = %s
                             ) THEN 1 ELSE 0 END
                    ), 0) as unread_total,
                    COALESCE(
                        STRING_AGG(DISTINCT u.id::text || ':' || u.online::text, ',' ORDER BY u.id::text || ':' || u.online::text),
                        ''
                    ) as online_snapshot
                FROM {SCHEMA}.chat_members cm
                LEFT JOIN {SCHEMA}.messages m ON m.chat_id = cm.chat_id
                LEFT JOIN {SCHEMA}.messages m2 ON m2.chat_id = cm.chat_id
                JOIN {SCHEMA}.chat_members cm2 ON cm2.chat_id = cm.chat_id AND cm2.user_id != %s
                JOIN {SCHEMA}.users u ON u.id = cm2.user_id
                WHERE cm.user_id = %s
            """, (user_id, user_id, user_id, user_id))
            chat_row = cur.fetchone()
            online_snapshot = chat_row[2] if chat_row else ''
            chat_version = f"{chat_row[0]}:{chat_row[1]}:{online_snapshot}" if chat_row else "0:0:"

            # Парсим online_map: {"user_id": bool, ...}
            online_map = {}
            if online_snapshot:
                for pair in online_snapshot.split(','):
                    if ':' in pair:
                        uid_str, status = pair.split(':', 1)
                        online_map[int(uid_str)] = (status == 'true')

            # Версия сообщений конкретного чата (если передан chat_id)
            msg_version = None
            if chat_id:
                cur.execute(
                    f"SELECT COALESCE(MAX(id), 0) FROM {SCHEMA}.messages WHERE chat_id = %s",
                    (int(chat_id),)
                )
                msg_row = cur.fetchone()
                msg_version = str(msg_row[0]) if msg_row else "0"

        return {
            'statusCode': 200,
            'headers': CORS,
            'body': json.dumps({
                'chat_version': chat_version,
                'msg_version': msg_version,
                'online_map': online_map,
            })
        }
    finally:
        conn.close()