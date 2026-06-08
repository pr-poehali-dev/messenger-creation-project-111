"""
Авторизация + профиль пользователей.
POST /register  — регистрация
POST /login     — вход
POST /logout    — выход
GET  /me        — текущий пользователь
PUT  /me        — обновить профиль
GET  /users     — список / поиск пользователей (?q=query)
"""
import json
import os
import hashlib
import secrets
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p31400750_messenger_creation_p')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def get_session_user(session_id: str, conn):
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT u.id, u.name, u.username, u.bio, u.phone, u.avatar_seed, u.online "
            f"FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.id = %s AND s.expires_at > NOW()",
            (session_id,)
        )
        row = cur.fetchone()
    if not row:
        return None
    return {'id': row[0], 'name': row[1], 'username': row[2], 'bio': row[3],
            'phone': row[4], 'avatar_seed': row[5], 'online': row[6]}


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')
    headers = event.get('headers') or {}
    session_id = headers.get('X-Session-Id', '')
    params = event.get('queryStringParameters') or {}

    conn = get_conn()
    try:
        # ---------- Public endpoints (no auth needed) ----------

        # POST /register
        if method == 'POST' and path.endswith('/register'):
            body = json.loads(event.get('body') or '{}')
            name = body.get('name', '').strip()
            username = body.get('username', '').strip().lower()
            password = body.get('password', '')
            phone = body.get('phone', '').strip()

            if not name or not username or not password:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Заполните все поля'})}
            if len(password) < 6:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Пароль минимум 6 символов'})}

            username = '@' + username.lstrip('@')
            seed = str(abs(hash(username)) % 8 + 1)

            with conn.cursor() as cur:
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE username = %s", (username,))
                if cur.fetchone():
                    return {'statusCode': 409, 'headers': CORS, 'body': json.dumps({'error': 'Имя пользователя занято'})}
                cur.execute(
                    f"INSERT INTO {SCHEMA}.users (name, username, password_hash, phone, avatar_seed) "
                    f"VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    (name, username, hash_password(password), phone, seed)
                )
                user_id = cur.fetchone()[0]
                sid = secrets.token_hex(32)
                cur.execute(f"INSERT INTO {SCHEMA}.sessions (id, user_id) VALUES (%s, %s)", (sid, user_id))
            conn.commit()

            user = {'id': user_id, 'name': name, 'username': username,
                    'bio': '', 'phone': phone, 'avatar_seed': seed, 'online': False}
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'session_id': sid, 'user': user})}

        # POST /login
        if method == 'POST' and path.endswith('/login'):
            body = json.loads(event.get('body') or '{}')
            username = '@' + body.get('username', '').strip().lower().lstrip('@')
            password = body.get('password', '')

            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, name, username, bio, phone, avatar_seed FROM {SCHEMA}.users "
                    f"WHERE username = %s AND password_hash = %s",
                    (username, hash_password(password))
                )
                row = cur.fetchone()
                if not row:
                    return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Неверный логин или пароль'})}
                user_id = row[0]
                sid = secrets.token_hex(32)
                cur.execute(f"INSERT INTO {SCHEMA}.sessions (id, user_id) VALUES (%s, %s)", (sid, user_id))
                cur.execute(f"UPDATE {SCHEMA}.users SET online = TRUE WHERE id = %s", (user_id,))
            conn.commit()

            user = {'id': row[0], 'name': row[1], 'username': row[2],
                    'bio': row[3], 'phone': row[4], 'avatar_seed': row[5], 'online': True}
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'session_id': sid, 'user': user})}

        # POST /logout
        if method == 'POST' and path.endswith('/logout'):
            if session_id:
                with conn.cursor() as cur:
                    cur.execute(f"SELECT user_id FROM {SCHEMA}.sessions WHERE id = %s", (session_id,))
                    row = cur.fetchone()
                    if row:
                        cur.execute(f"UPDATE {SCHEMA}.users SET online = FALSE WHERE id = %s", (row[0],))
                    cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE id = %s", (session_id,))
                conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        # ---------- Auth-required endpoints ----------

        user = get_session_user(session_id, conn)
        if not user:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        user_id = user['id']

        # GET /me
        if method == 'GET' and path.endswith('/me'):
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'user': user})}

        # PUT /me — обновить профиль
        if method == 'PUT' and path.endswith('/me'):
            body = json.loads(event.get('body') or '{}')
            name = body.get('name', '').strip()
            bio = body.get('bio', '').strip()
            phone = body.get('phone', '').strip()

            if not name:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Имя обязательно'})}

            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET name = %s, bio = %s, phone = %s WHERE id = %s "
                    f"RETURNING id, name, username, bio, phone, avatar_seed, online",
                    (name, bio, phone, user_id)
                )
                row = cur.fetchone()
            conn.commit()

            updated = {'id': row[0], 'name': row[1], 'username': row[2],
                       'bio': row[3], 'phone': row[4], 'avatar_seed': row[5], 'online': row[6]}
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'user': updated})}

        # GET /users — список / поиск пользователей
        if method == 'GET' and path.endswith('/users'):
            q = params.get('q', '').strip()
            with conn.cursor() as cur:
                if q:
                    like = f'%{q}%'
                    cur.execute(
                        f"SELECT id, name, username, bio, phone, avatar_seed, online, last_seen "
                        f"FROM {SCHEMA}.users WHERE id != %s AND (name ILIKE %s OR username ILIKE %s) "
                        f"ORDER BY online DESC, name LIMIT 30",
                        (user_id, like, like)
                    )
                else:
                    cur.execute(
                        f"SELECT id, name, username, bio, phone, avatar_seed, online, last_seen "
                        f"FROM {SCHEMA}.users WHERE id != %s ORDER BY online DESC, name LIMIT 50",
                        (user_id,)
                    )
                rows = cur.fetchall()

            users_list = []
            for r in rows:
                uid, uname, uusername, ubio, uphone, uavatar, uonline, ulast = r
                users_list.append({
                    'id': uid, 'name': uname, 'username': uusername,
                    'bio': ubio, 'phone': uphone, 'avatar_seed': uavatar,
                    'online': uonline,
                    'lastSeen': ulast.strftime('%d.%m %H:%M') if ulast else '',
                })
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'users': users_list})}

        return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Not found'})}
    finally:
        conn.close()
