"""
Авторизация + профиль пользователей. v3
Роутинг через ?action= (cloud functions не поддерживают пути)
POST ?action=register — регистрация
POST ?action=login    — вход
POST ?action=logout   — выход
GET  ?action=me       — текущий пользователь
PUT  ?action=me       — обновить профиль
GET  ?action=users    — список / поиск (?q=query)
"""
import json
import os
import hashlib
import secrets
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p31400750_messenger_creation_p')
CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
}


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def get_session_user(session_id: str, conn):
    with conn.cursor() as cur:
        cur.execute(
            f"SELECT u.id, u.name, u.username, u.bio, u.phone, u.avatar_seed, u.online, u.email "
            f"FROM {SCHEMA}.sessions s JOIN {SCHEMA}.users u ON u.id = s.user_id "
            f"WHERE s.id = %s AND s.expires_at > NOW()",
            (session_id,)
        )
        row = cur.fetchone()
    if not row:
        return None
    return {'id': row[0], 'name': row[1], 'username': row[2], 'bio': row[3],
            'phone': row[4], 'avatar_seed': row[5], 'online': row[6], 'email': row[7]}


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
        # ── POST ?action=register ─────────────────────────────────────────────
        if method == 'POST' and action == 'register':
            body = json.loads(event.get('body') or '{}')
            name = body.get('name', '').strip()
            username = body.get('username', '').strip().lower()
            password = body.get('password', '')
            email = body.get('email', '').strip().lower()
            phone = body.get('phone', '').strip()

            if not name or not username or not password:
                return {'statusCode': 400, 'headers': CORS,
                        'body': json.dumps({'error': 'Заполните все поля'})}
            if len(password) < 6:
                return {'statusCode': 400, 'headers': CORS,
                        'body': json.dumps({'error': 'Пароль минимум 6 символов'})}
            if email and ('@' not in email or '.' not in email.split('@')[-1]):
                return {'statusCode': 400, 'headers': CORS,
                        'body': json.dumps({'error': 'Некорректный email'})}

            username = '@' + username.lstrip('@')
            seed = str(abs(hash(username)) % 8 + 1)

            with conn.cursor() as cur:
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE username = %s", (username,))
                if cur.fetchone():
                    return {'statusCode': 409, 'headers': CORS,
                            'body': json.dumps({'error': 'Имя пользователя занято'})}
                if email:
                    cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s", (email,))
                    if cur.fetchone():
                        return {'statusCode': 409, 'headers': CORS,
                                'body': json.dumps({'error': 'Email уже используется'})}
                cur.execute(
                    f"INSERT INTO {SCHEMA}.users (name, username, password_hash, phone, avatar_seed, email) "
                    f"VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
                    (name, username, hash_password(password), phone, seed, email or None)
                )
                user_id = cur.fetchone()[0]
                sid = secrets.token_hex(32)
                cur.execute(f"INSERT INTO {SCHEMA}.sessions (id, user_id) VALUES (%s, %s)", (sid, user_id))
            conn.commit()

            user = {'id': user_id, 'name': name, 'username': username,
                    'bio': '', 'phone': phone, 'avatar_seed': seed,
                    'email': email or None, 'online': False}
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({'session_id': sid, 'user': user})}

        # ── POST ?action=login ────────────────────────────────────────────────
        if method == 'POST' and action == 'login':
            body = json.loads(event.get('body') or '{}')
            login_input = body.get('username', '').strip().lower()
            password = body.get('password', '')

            with conn.cursor() as cur:
                if '@' in login_input and '.' in login_input.split('@')[-1]:
                    cur.execute(
                        f"SELECT id, name, username, bio, phone, avatar_seed, email FROM {SCHEMA}.users "
                        f"WHERE email = %s AND password_hash = %s",
                        (login_input, hash_password(password))
                    )
                else:
                    uname = '@' + login_input.lstrip('@')
                    cur.execute(
                        f"SELECT id, name, username, bio, phone, avatar_seed, email FROM {SCHEMA}.users "
                        f"WHERE username = %s AND password_hash = %s",
                        (uname, hash_password(password))
                    )
                row = cur.fetchone()
                if not row:
                    return {'statusCode': 401, 'headers': CORS,
                            'body': json.dumps({'error': 'Неверный логин или пароль'})}
                user_id = row[0]
                sid = secrets.token_hex(32)
                cur.execute(f"INSERT INTO {SCHEMA}.sessions (id, user_id) VALUES (%s, %s)", (sid, user_id))
                cur.execute(f"UPDATE {SCHEMA}.users SET online = TRUE WHERE id = %s", (user_id,))
            conn.commit()

            user = {'id': row[0], 'name': row[1], 'username': row[2],
                    'bio': row[3], 'phone': row[4], 'avatar_seed': row[5],
                    'email': row[6], 'online': True}
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({'session_id': sid, 'user': user})}

        # ── POST ?action=logout ───────────────────────────────────────────────
        if method == 'POST' and action == 'logout':
            if session_id:
                with conn.cursor() as cur:
                    cur.execute(f"SELECT user_id FROM {SCHEMA}.sessions WHERE id = %s", (session_id,))
                    row = cur.fetchone()
                    if row:
                        cur.execute(f"UPDATE {SCHEMA}.users SET online = FALSE WHERE id = %s", (row[0],))
                    cur.execute(f"UPDATE {SCHEMA}.sessions SET expires_at = NOW() WHERE id = %s", (session_id,))
                conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        # ── Auth-required endpoints ───────────────────────────────────────────
        user = get_session_user(session_id, conn)
        if not user:
            return {'statusCode': 401, 'headers': CORS,
                    'body': json.dumps({'error': 'Не авторизован'})}

        user_id = user['id']

        # POST ?action=heartbeat — обновить last_seen и online
        if method == 'POST' and action == 'heartbeat':
            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET online = TRUE, last_seen = NOW() WHERE id = %s",
                    (user_id,)
                )
                # Помечаем офлайн всех, кто не пинговал больше 2 минут
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET online = FALSE "
                    f"WHERE online = TRUE AND last_seen < NOW() - INTERVAL '2 minutes' AND id != %s",
                    (user_id,)
                )
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        # GET ?action=me
        if method == 'GET' and action == 'me':
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'user': user})}

        # PUT ?action=me
        if method == 'PUT' and action == 'me':
            body = json.loads(event.get('body') or '{}')
            name = body.get('name', '').strip()
            bio = body.get('bio', '').strip()
            phone = body.get('phone', '').strip()

            if not name:
                return {'statusCode': 400, 'headers': CORS,
                        'body': json.dumps({'error': 'Имя обязательно'})}

            with conn.cursor() as cur:
                cur.execute(
                    f"UPDATE {SCHEMA}.users SET name = %s, bio = %s, phone = %s WHERE id = %s "
                    f"RETURNING id, name, username, bio, phone, avatar_seed, online, email",
                    (name, bio, phone, user_id)
                )
                row = cur.fetchone()
            conn.commit()

            updated = {'id': row[0], 'name': row[1], 'username': row[2], 'bio': row[3],
                       'phone': row[4], 'avatar_seed': row[5], 'online': row[6], 'email': row[7]}
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'user': updated})}

        # GET ?action=users&q=username — поиск только по точному username (для добавления)
        if method == 'GET' and action == 'users':
            q = params.get('q', '').strip().lstrip('@').lower()
            if not q:
                return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'users': []})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, name, username, bio, phone, avatar_seed, online, last_seen "
                    f"FROM {SCHEMA}.users WHERE id != %s AND LOWER(username) = %s LIMIT 1",
                    (user_id, q)
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
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({'users': users_list})}

        # GET ?action=contacts — список своих контактов
        if method == 'GET' and action == 'contacts':
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT u.id, u.name, u.username, u.bio, u.phone, u.avatar_seed, u.online, u.last_seen "
                    f"FROM {SCHEMA}.contacts c "
                    f"JOIN {SCHEMA}.users u ON u.id = c.contact_id "
                    f"WHERE c.owner_id = %s "
                    f"ORDER BY u.online DESC, u.name ASC",
                    (user_id,)
                )
                rows = cur.fetchall()
            contacts_list = []
            for r in rows:
                uid, uname, uusername, ubio, uphone, uavatar, uonline, ulast = r
                contacts_list.append({
                    'id': uid, 'name': uname, 'username': uusername,
                    'bio': ubio, 'phone': uphone, 'avatar_seed': uavatar,
                    'online': uonline,
                    'lastSeen': ulast.strftime('%d.%m %H:%M') if ulast else '',
                })
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({'contacts': contacts_list})}

        # POST ?action=contacts — добавить контакт
        if method == 'POST' and action == 'contacts':
            body = json.loads(event.get('body') or '{}')
            contact_id = int(body.get('contact_id', 0))
            if not contact_id or contact_id == user_id:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверный пользователь'})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT 1 FROM {SCHEMA}.users WHERE id = %s", (contact_id,)
                )
                if not cur.fetchone():
                    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Пользователь не найден'})}
                cur.execute(
                    f"INSERT INTO {SCHEMA}.contacts (owner_id, contact_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (user_id, contact_id)
                )
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        # DELETE ?action=contacts — удалить контакт
        if method == 'DELETE' and action == 'contacts':
            body = json.loads(event.get('body') or '{}')
            contact_id = int(body.get('contact_id', 0))
            if not contact_id:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверный пользователь'})}
            with conn.cursor() as cur:
                cur.execute(
                    f"DELETE FROM {SCHEMA}.contacts WHERE owner_id = %s AND contact_id = %s",
                    (user_id, contact_id)
                )
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        # GET ?action=user_relation&user_id=X — статус отношений с пользователем
        if method == 'GET' and action == 'user_relation':
            target_id = int(params.get('user_id', 0))
            if not target_id:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'user_id required'})}
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, name, username, bio, phone, avatar_seed, online, last_seen "
                    f"FROM {SCHEMA}.users WHERE id = %s", (target_id,)
                )
                urow = cur.fetchone()
                if not urow:
                    return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Не найден'})}
                cur.execute(
                    f"SELECT 1 FROM {SCHEMA}.contacts WHERE owner_id = %s AND contact_id = %s",
                    (user_id, target_id)
                )
                is_contact = bool(cur.fetchone())
                cur.execute(
                    f"SELECT 1 FROM {SCHEMA}.blocked_users WHERE blocker_id = %s AND blocked_id = %s",
                    (user_id, target_id)
                )
                is_blocked = bool(cur.fetchone())
                cur.execute(
                    f"SELECT 1 FROM {SCHEMA}.blocked_users WHERE blocker_id = %s AND blocked_id = %s",
                    (target_id, user_id)
                )
                is_blocked_by_other = bool(cur.fetchone())
            uid, uname, uusername, ubio, uphone, uavatar, uonline, ulast = urow
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({
                'user': {
                    'id': uid, 'name': uname, 'username': uusername,
                    'bio': ubio, 'phone': uphone, 'avatar_seed': uavatar,
                    'online': uonline,
                    'lastSeen': ulast.strftime('%d.%m %H:%M') if ulast else '',
                },
                'is_contact': is_contact,
                'is_blocked': is_blocked,
                'is_blocked_by_other': is_blocked_by_other,
            })}

        # POST ?action=block — заблокировать
        if method == 'POST' and action == 'block':
            body = json.loads(event.get('body') or '{}')
            target_id = int(body.get('user_id', 0))
            if not target_id or target_id == user_id:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверный пользователь'})}
            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.blocked_users (blocker_id, blocked_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                    (user_id, target_id)
                )
                # При блокировке удаляем из контактов в обе стороны
                cur.execute(
                    f"DELETE FROM {SCHEMA}.contacts WHERE (owner_id = %s AND contact_id = %s) OR (owner_id = %s AND contact_id = %s)",
                    (user_id, target_id, target_id, user_id)
                )
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        # POST ?action=unblock — разблокировать
        if method == 'POST' and action == 'unblock':
            body = json.loads(event.get('body') or '{}')
            target_id = int(body.get('user_id', 0))
            if not target_id:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверный пользователь'})}
            with conn.cursor() as cur:
                cur.execute(
                    f"DELETE FROM {SCHEMA}.blocked_users WHERE blocker_id = %s AND blocked_id = %s",
                    (user_id, target_id)
                )
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Not found'})}
    finally:
        conn.close()