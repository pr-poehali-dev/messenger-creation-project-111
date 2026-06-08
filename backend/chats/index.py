"""
Чаты + сообщения. v2 — роутинг через ?action=
GET  ?action=chats                        — список чатов
POST ?action=chats                        — создать чат
GET  ?action=messages&chat_id=N           — история сообщений
POST ?action=messages                     — отправить сообщение
POST ?action=read                         — пометить прочитанными
"""
import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p31400750_messenger_creation_p')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}


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


def is_member(chat_id: int, user_id: int, conn) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT 1 FROM {SCHEMA}.chat_members WHERE chat_id = %s AND user_id = %s",
            (chat_id, user_id)
        )
        return cur.fetchone() is not None


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    headers = event.get('headers') or {}
    session_id = headers.get('X-Session-Id', '')
    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    conn = get_conn()
    try:
        user_id = get_session_user_id(session_id, conn)
        if not user_id:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        # GET ?action=chats
        if method == 'GET' and action == 'chats':
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT
                        c.id, c.type, c.name, c.avatar_seed,
                        (SELECT COUNT(*) FROM {SCHEMA}.chat_members cm2 WHERE cm2.chat_id = c.id) as members_count,
                        (SELECT m.text FROM {SCHEMA}.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_msg,
                        (SELECT m.created_at FROM {SCHEMA}.messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_time,
                        (SELECT COUNT(*) FROM {SCHEMA}.messages m
                            WHERE m.chat_id = c.id AND m.sender_id != %s
                            AND NOT EXISTS (
                                SELECT 1 FROM {SCHEMA}.message_reads mr
                                WHERE mr.message_id = m.id AND mr.user_id = %s
                            )
                        ) as unread_count,
                        (SELECT u.name FROM {SCHEMA}.users u
                            JOIN {SCHEMA}.chat_members cm3 ON cm3.user_id = u.id
                            WHERE cm3.chat_id = c.id AND u.id != %s LIMIT 1) as other_name,
                        (SELECT u.avatar_seed FROM {SCHEMA}.users u
                            JOIN {SCHEMA}.chat_members cm3 ON cm3.user_id = u.id
                            WHERE cm3.chat_id = c.id AND u.id != %s LIMIT 1) as other_avatar,
                        (SELECT u.online FROM {SCHEMA}.users u
                            JOIN {SCHEMA}.chat_members cm3 ON cm3.user_id = u.id
                            WHERE cm3.chat_id = c.id AND u.id != %s LIMIT 1) as other_online
                    FROM {SCHEMA}.chats c
                    JOIN {SCHEMA}.chat_members cm ON cm.chat_id = c.id AND cm.user_id = %s
                    ORDER BY last_time DESC NULLS LAST
                """, (user_id, user_id, user_id, user_id, user_id, user_id))
                rows = cur.fetchall()

            chats = []
            for r in rows:
                cid, ctype, cname, cavatar, members, last_msg, last_time, unread, oname, oavatar, oonline = r
                display_name = cname if ctype != 'direct' else (oname or 'Пользователь')
                display_avatar = cavatar if ctype != 'direct' else (oavatar or '1')
                chats.append({
                    'id': cid, 'type': ctype, 'name': display_name,
                    'avatar': display_avatar, 'members': members,
                    'lastMessage': last_msg or '',
                    'lastTime': last_time.strftime('%H:%M') if last_time else '',
                    'unread': int(unread), 'online': bool(oonline),
                })
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'chats': chats})}

        # POST ?action=chats
        if method == 'POST' and action == 'chats':
            body = json.loads(event.get('body') or '{}')
            ctype = body.get('type', 'group')
            cname = body.get('name', '').strip()
            member_ids = body.get('member_ids', [])

            if ctype == 'direct':
                other_id = body.get('other_user_id')
                if not other_id:
                    return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите пользователя'})}
                with conn.cursor() as cur:
                    cur.execute(f"""
                        SELECT c.id FROM {SCHEMA}.chats c
                        JOIN {SCHEMA}.chat_members m1 ON m1.chat_id = c.id AND m1.user_id = %s
                        JOIN {SCHEMA}.chat_members m2 ON m2.chat_id = c.id AND m2.user_id = %s
                        WHERE c.type = 'direct' LIMIT 1
                    """, (user_id, other_id))
                    existing = cur.fetchone()
                    if existing:
                        return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'chat_id': existing[0]})}
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.chats (type, created_by) VALUES ('direct', %s) RETURNING id",
                        (user_id,)
                    )
                    chat_id = cur.fetchone()[0]
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id, role) VALUES (%s, %s, 'owner'), (%s, %s, 'member')",
                        (chat_id, user_id, chat_id, int(other_id))
                    )
                conn.commit()
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'chat_id': chat_id})}

            if not cname:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Введите название'})}

            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.chats (type, name, created_by) VALUES (%s, %s, %s) RETURNING id",
                    (ctype, cname, user_id)
                )
                chat_id = cur.fetchone()[0]
                cur.execute(
                    f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id, role) VALUES (%s, %s, 'owner')",
                    (chat_id, user_id)
                )
                for mid in member_ids:
                    cur.execute(
                        f"INSERT INTO {SCHEMA}.chat_members (chat_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                        (chat_id, int(mid))
                    )
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'chat_id': chat_id})}

        # GET ?action=messages&chat_id=N
        if method == 'GET' and action == 'messages':
            chat_id = params.get('chat_id')
            if not chat_id:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите chat_id'})}
            chat_id = int(chat_id)
            if not is_member(chat_id, user_id, conn):
                return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}

            limit = int(params.get('limit', 50))
            offset = int(params.get('offset', 0))

            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT m.id, m.sender_id, m.text, m.type, m.file_url, m.file_name, m.created_at,
                           u.name, u.avatar_seed,
                           EXISTS(
                               SELECT 1 FROM {SCHEMA}.message_reads mr
                               WHERE mr.message_id = m.id AND mr.user_id != m.sender_id LIMIT 1
                           ) as is_read
                    FROM {SCHEMA}.messages m
                    LEFT JOIN {SCHEMA}.users u ON u.id = m.sender_id
                    WHERE m.chat_id = %s
                    ORDER BY m.created_at ASC
                    LIMIT %s OFFSET %s
                """, (chat_id, limit, offset))
                rows = cur.fetchall()

            msgs = []
            for r in rows:
                mid, sid, text, mtype, furl, fname, ts, sname, savatar, is_read = r
                msgs.append({
                    'id': mid, 'senderId': sid, 'isMe': sid == user_id,
                    'senderName': sname or '', 'senderAvatar': savatar or '1',
                    'text': text, 'type': mtype,
                    'fileUrl': furl, 'fileName': fname,
                    'time': ts.strftime('%H:%M'), 'read': bool(is_read),
                })
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'messages': msgs})}

        # POST ?action=read
        if method == 'POST' and action == 'read':
            body = json.loads(event.get('body') or '{}')
            chat_id = int(body.get('chat_id', 0))
            with conn.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO {SCHEMA}.message_reads (message_id, user_id)
                    SELECT m.id, %s FROM {SCHEMA}.messages m
                    WHERE m.chat_id = %s AND m.sender_id != %s
                    AND NOT EXISTS (
                        SELECT 1 FROM {SCHEMA}.message_reads mr
                        WHERE mr.message_id = m.id AND mr.user_id = %s
                    )
                """, (user_id, chat_id, user_id, user_id))
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        # POST ?action=messages
        if method == 'POST' and action == 'messages':
            body = json.loads(event.get('body') or '{}')
            chat_id = int(body.get('chat_id', 0))
            text = body.get('text', '').strip()
            file_url = body.get('file_url', None)
            file_name = body.get('file_name', None)
            msg_type = body.get('type', 'text')

            if not chat_id or (not text and not file_url):
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Укажите chat_id и text или файл'})}
            if not is_member(chat_id, user_id, conn):
                return {'statusCode': 403, 'headers': CORS, 'body': json.dumps({'error': 'Нет доступа'})}

            stored_text = text if text else (file_name or 'Файл')

            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.messages (chat_id, sender_id, text, type, file_url, file_name) "
                    f"VALUES (%s, %s, %s, %s, %s, %s) RETURNING id, created_at",
                    (chat_id, user_id, stored_text, msg_type, file_url, file_name)
                )
                msg_id, created_at = cur.fetchone()
                cur.execute(
                    f"INSERT INTO {SCHEMA}.message_reads (message_id, user_id) VALUES (%s, %s)",
                    (msg_id, user_id)
                )
                cur.execute(f"SELECT name, avatar_seed FROM {SCHEMA}.users WHERE id = %s", (user_id,))
                urow = cur.fetchone()
            conn.commit()

            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'message': {
                    'id': msg_id, 'senderId': user_id, 'isMe': True,
                    'senderName': urow[0] if urow else '',
                    'senderAvatar': urow[1] if urow else '1',
                    'text': stored_text, 'type': msg_type,
                    'fileUrl': file_url, 'fileName': file_name,
                    'time': created_at.strftime('%H:%M'), 'read': False,
                }
            })}

        return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Not found'})}
    finally:
        conn.close()