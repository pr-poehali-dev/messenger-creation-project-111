"""
WebRTC Signaling. Обмен сигналами через polling.
POST ?action=send   — отправить сигнал (offer/answer/ice-candidate/hang-up/ring)
GET  ?action=poll   — получить новые сигналы для текущего пользователя
POST ?action=clear  — очистить сигналы по call_id
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

VALID_TYPES = {'offer', 'answer', 'ice-candidate', 'hang-up', 'ring', 'reject'}


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
        user_id = get_user(session_id, conn)
        if not user_id:
            return {'statusCode': 401, 'headers': CORS, 'body': json.dumps({'error': 'Не авторизован'})}

        # POST ?action=send — отправить сигнал
        if method == 'POST' and action == 'send':
            body = json.loads(event.get('body') or '{}')
            call_id = body.get('call_id', '').strip()
            to_user_id = body.get('to_user_id')
            sig_type = body.get('type', '')
            payload = body.get('payload', '')

            if not call_id or not to_user_id or sig_type not in VALID_TYPES:
                return {'statusCode': 400, 'headers': CORS, 'body': json.dumps({'error': 'Неверные параметры'})}

            with conn.cursor() as cur:
                cur.execute(
                    f"INSERT INTO {SCHEMA}.call_signals (call_id, from_user_id, to_user_id, type, payload) "
                    f"VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    (call_id, user_id, int(to_user_id), sig_type, json.dumps(payload) if not isinstance(payload, str) else payload)
                )
                sig_id = cur.fetchone()[0]
            conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True, 'id': sig_id})}

        # GET ?action=poll&after_id=N — получить новые сигналы
        if method == 'GET' and action == 'poll':
            after_id = int(params.get('after_id', 0))
            with conn.cursor() as cur:
                cur.execute(
                    f"SELECT id, call_id, from_user_id, type, payload, created_at "
                    f"FROM {SCHEMA}.call_signals "
                    f"WHERE to_user_id = %s AND id > %s "
                    f"ORDER BY id ASC LIMIT 20",
                    (user_id, after_id)
                )
                rows = cur.fetchall()
            signals = []
            for r in rows:
                sid, call_id, from_uid, stype, payload, ts = r
                try:
                    payload_data = json.loads(payload)
                except Exception:
                    payload_data = payload
                signals.append({
                    'id': sid,
                    'call_id': call_id,
                    'from_user_id': from_uid,
                    'type': stype,
                    'payload': payload_data,
                    'ts': ts.isoformat(),
                })
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'signals': signals})}

        # POST ?action=clear — удалить сигналы звонка
        if method == 'POST' and action == 'clear':
            body = json.loads(event.get('body') or '{}')
            call_id = body.get('call_id', '')
            if call_id:
                with conn.cursor() as cur:
                    cur.execute(
                        f"DELETE FROM {SCHEMA}.call_signals WHERE call_id = %s AND (from_user_id = %s OR to_user_id = %s)",
                        (call_id, user_id, user_id)
                    )
                conn.commit()
            return {'statusCode': 200, 'headers': CORS, 'body': json.dumps({'ok': True})}

        return {'statusCode': 404, 'headers': CORS, 'body': json.dumps({'error': 'Not found'})}
    finally:
        conn.close()
