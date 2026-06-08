"""
Авторизация + профиль пользователей.
POST /send-code   — отправить код подтверждения на email (шаг 1 регистрации)
POST /verify-code — проверить код и создать аккаунт (шаг 2 регистрации)
POST /register    — быстрая регистрация без email (legacy, оставлен)
POST /login       — вход (по username или email)
POST /logout      — выход
GET  /me          — текущий пользователь
PUT  /me          — обновить профиль
GET  /users       — список / поиск пользователей (?q=query)
"""
import json
import os
import hashlib
import secrets
import random
import urllib.request
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


def send_email_unisender(to_email: str, code: str, name: str):
    api_key = os.environ.get('UNISENDER_API_KEY', '')
    from_email = os.environ.get('UNISENDER_FROM_EMAIL', '')
    if not api_key or not from_email:
        raise RuntimeError('UniSender не настроен')

    html = f"""
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0d0f17;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;width:56px;height:56px;border-radius:14px;background:linear-gradient(135deg,#8b5cf6,#06d6f5);line-height:56px;font-size:24px;font-weight:900;color:white;">P</div>
        <h2 style="color:white;margin:12px 0 4px;font-size:22px;">PULSE</h2>
        <p style="color:#6b7280;margin:0;font-size:14px;">Подтверждение email</p>
      </div>
      <p style="color:#d1d5db;font-size:15px;margin-bottom:8px;">Привет, <b style="color:white;">{name}</b>!</p>
      <p style="color:#9ca3af;font-size:14px;margin-bottom:24px;">Твой код подтверждения для регистрации в PULSE:</p>
      <div style="text-align:center;margin:28px 0;">
        <span style="display:inline-block;background:linear-gradient(135deg,rgba(139,92,246,0.2),rgba(6,214,245,0.1));border:1px solid rgba(139,92,246,0.4);border-radius:14px;padding:18px 40px;font-size:36px;font-weight:900;letter-spacing:10px;color:white;">{code}</span>
      </div>
      <p style="color:#6b7280;font-size:13px;text-align:center;">Код действителен 10 минут. Не передавай его никому.</p>
    </div>
    """

    import urllib.parse
    params = urllib.parse.urlencode({
        'api_key': api_key,
        'format': 'json',
        'email': to_email,
        'sender_name': 'PULSE Мессенджер',
        'sender_email': from_email,
        'subject': f'Код подтверждения: {code}',
        'body': html,
        'list_id': '1',
    }).encode('utf-8')

    req = urllib.request.Request(
        'https://api.unisender.com/ru/api/sendEmail',
        data=params,
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        result = json.loads(resp.read().decode('utf-8'))
        if 'error' in result:
            raise RuntimeError(f'UniSender error: {result["error"]}')


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
        # ── POST /send-code ───────────────────────────────────────────────────
        if method == 'POST' and path.endswith('/send-code'):
            body = json.loads(event.get('body') or '{}')
            email = body.get('email', '').strip().lower()
            name = body.get('name', '').strip()
            username = body.get('username', '').strip().lower()
            password = body.get('password', '')
            phone = body.get('phone', '').strip()

            if not email or not name or not username or not password:
                return {'statusCode': 400, 'headers': CORS,
                        'body': json.dumps({'error': 'Заполните все поля'})}
            if '@' not in email or '.' not in email.split('@')[-1]:
                return {'statusCode': 400, 'headers': CORS,
                        'body': json.dumps({'error': 'Некорректный email'})}
            if len(password) < 6:
                return {'statusCode': 400, 'headers': CORS,
                        'body': json.dumps({'error': 'Пароль минимум 6 символов'})}

            username = '@' + username.lstrip('@')
            seed = str(abs(hash(username)) % 8 + 1)

            with conn.cursor() as cur:
                # Check username taken
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE username = %s", (username,))
                if cur.fetchone():
                    return {'statusCode': 409, 'headers': CORS,
                            'body': json.dumps({'error': 'Имя пользователя занято'})}
                # Check email taken
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE email = %s", (email,))
                if cur.fetchone():
                    return {'statusCode': 409, 'headers': CORS,
                            'body': json.dumps({'error': 'Email уже используется'})}
                # Rate limit: max 3 codes per email per 10 min
                cur.execute(
                    f"SELECT COUNT(*) FROM {SCHEMA}.email_codes "
                    f"WHERE email = %s AND created_at > NOW() - INTERVAL '10 minutes'",
                    (email,)
                )
                count = cur.fetchone()[0]
                if count >= 3:
                    return {'statusCode': 429, 'headers': CORS,
                            'body': json.dumps({'error': 'Слишком много попыток. Подождите 10 минут.'})}

                # Generate 6-digit code
                code = str(random.randint(100000, 999999))

                # Store pending registration
                cur.execute(
                    f"INSERT INTO {SCHEMA}.email_codes "
                    f"(email, code, name, username, password_hash, phone, avatar_seed) "
                    f"VALUES (%s, %s, %s, %s, %s, %s, %s)",
                    (email, code, name, username, hash_password(password), phone, seed)
                )
            conn.commit()

            # Send email
            send_email_unisender(email, code, name)

            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({'ok': True, 'email': email})}

        # ── POST /verify-code ─────────────────────────────────────────────────
        if method == 'POST' and path.endswith('/verify-code'):
            body = json.loads(event.get('body') or '{}')
            email = body.get('email', '').strip().lower()
            code = body.get('code', '').strip()

            if not email or not code:
                return {'statusCode': 400, 'headers': CORS,
                        'body': json.dumps({'error': 'Укажите email и код'})}

            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, code, name, username, password_hash, phone, avatar_seed, attempts, expires_at "
                    f"FROM {SCHEMA}.email_codes "
                    f"WHERE email = %s AND expires_at > NOW() "
                    f"ORDER BY created_at DESC LIMIT 1",
                    (email,)
                )
                row = cur.fetchone()
                if not row:
                    return {'statusCode': 400, 'headers': CORS,
                            'body': json.dumps({'error': 'Код не найден или истёк. Запросите новый.'})}

                rec_id, stored_code, name, username, pw_hash, phone, seed, attempts, _ = row

                if attempts >= 5:
                    return {'statusCode': 429, 'headers': CORS,
                            'body': json.dumps({'error': 'Слишком много неверных попыток. Запросите новый код.'})}

                if code != stored_code:
                    cur.execute(
                        f"UPDATE {SCHEMA}.email_codes SET attempts = attempts + 1 WHERE id = %s", (rec_id,)
                    )
                    conn.commit()
                    left = 5 - attempts - 1
                    return {'statusCode': 400, 'headers': CORS,
                            'body': json.dumps({'error': f'Неверный код. Осталось попыток: {left}'})}

                # Code correct — create user
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE username = %s", (username,))
                if cur.fetchone():
                    return {'statusCode': 409, 'headers': CORS,
                            'body': json.dumps({'error': 'Имя пользователя уже занято'})}

                cur.execute(
                    f"INSERT INTO {SCHEMA}.users "
                    f"(name, username, password_hash, phone, avatar_seed, email, email_verified) "
                    f"VALUES (%s, %s, %s, %s, %s, %s, TRUE) RETURNING id",
                    (name, username, pw_hash, phone, seed, email)
                )
                user_id = cur.fetchone()[0]

                sid = secrets.token_hex(32)
                cur.execute(f"INSERT INTO {SCHEMA}.sessions (id, user_id) VALUES (%s, %s)", (sid, user_id))

                # Invalidate all codes for this email
                cur.execute(
                    f"UPDATE {SCHEMA}.email_codes SET expires_at = NOW() WHERE email = %s", (email,)
                )
            conn.commit()

            user = {'id': user_id, 'name': name, 'username': username,
                    'bio': '', 'phone': phone, 'avatar_seed': seed,
                    'email': email, 'online': False}
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({'session_id': sid, 'user': user})}

        # ── POST /register (legacy, без email) ───────────────────────────────
        if method == 'POST' and path.endswith('/register'):
            body = json.loads(event.get('body') or '{}')
            name = body.get('name', '').strip()
            username = body.get('username', '').strip().lower()
            password = body.get('password', '')
            phone = body.get('phone', '').strip()

            if not name or not username or not password:
                return {'statusCode': 400, 'headers': CORS,
                        'body': json.dumps({'error': 'Заполните все поля'})}
            if len(password) < 6:
                return {'statusCode': 400, 'headers': CORS,
                        'body': json.dumps({'error': 'Пароль минимум 6 символов'})}

            username = '@' + username.lstrip('@')
            seed = str(abs(hash(username)) % 8 + 1)

            with conn.cursor() as cur:
                cur.execute(f"SELECT id FROM {SCHEMA}.users WHERE username = %s", (username,))
                if cur.fetchone():
                    return {'statusCode': 409, 'headers': CORS,
                            'body': json.dumps({'error': 'Имя пользователя занято'})}
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
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({'session_id': sid, 'user': user})}

        # ── POST /login ───────────────────────────────────────────────────────
        if method == 'POST' and path.endswith('/login'):
            body = json.loads(event.get('body') or '{}')
            login_input = body.get('username', '').strip().lower()
            password = body.get('password', '')

            with conn.cursor() as cur:
                # Try username or email
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

        # ── POST /logout ──────────────────────────────────────────────────────
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

        # ── Auth-required endpoints ────────────────────────────────────────────
        user = get_session_user(session_id, conn)
        if not user:
            return {'statusCode': 401, 'headers': CORS,
                    'body': json.dumps({'error': 'Не авторизован'})}

        user_id = user['id']

        # GET /me
        if method == 'GET' and path.endswith('/me'):
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'user': user})}

        # PUT /me
        if method == 'PUT' and path.endswith('/me'):
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

        # GET /users
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
            return {'statusCode': 200, 'headers': CORS,
                    'body': json.dumps({'users': users_list})}

        return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Not found'})}
    finally:
        conn.close()