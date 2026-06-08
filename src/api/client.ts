const URLS = {
  auth: 'https://functions.poehali.dev/2af8a493-4b0f-4728-9b44-595ad8d4e50f',
  chats: 'https://functions.poehali.dev/95f220d4-6f2d-4a0c-94b0-d5b3b286afd3',
  upload: 'https://functions.poehali.dev/a9c74801-66be-4f54-90be-9eab93b57c18',
  signal: 'https://functions.poehali.dev/fea04015-cf4e-4b0a-a39d-52641f674f9d',
};

function getSessionId(): string {
  return localStorage.getItem('session_id') || '';
}

async function request(
  base: keyof typeof URLS,
  path: string,
  options: RequestInit = {}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const url = URLS[base] + path;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const sid = getSessionId();
  if (sid) headers['X-Session-Id'] = sid;

  const { headers: _h, ...restOptions } = options;
  const res = await fetch(url, { ...restOptions, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
}

// ---- Auth ----
export const api = {
  register: (name: string, username: string, password: string, phone?: string, email?: string) =>
    request('auth', '/?action=register', {
      method: 'POST',
      body: JSON.stringify({ name, username, password, phone, email }),
    }),

  login: (username: string, password: string) =>
    request('auth', '/?action=login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request('auth', '/?action=logout', { method: 'POST' }),

  getMe: () =>
    request('auth', '/?action=me', { method: 'GET' }),

  updateMe: (data: { name: string; bio: string; phone: string }) =>
    request('auth', '/?action=me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getUsers: (q?: string) =>
    request('auth', '/?action=users' + (q ? `&q=${encodeURIComponent(q)}` : ''), { method: 'GET' }),

  // ---- Chats ----
  getChats: () =>
    request('chats', '/?action=chats', { method: 'GET' }),

  createDirectChat: (otherUserId: number) =>
    request('chats', '/?action=chats', {
      method: 'POST',
      body: JSON.stringify({ type: 'direct', other_user_id: otherUserId }),
    }),

  createGroupChat: (name: string, type: 'group' | 'channel', memberIds: number[]) =>
    request('chats', '/?action=chats', {
      method: 'POST',
      body: JSON.stringify({ type, name, member_ids: memberIds }),
    }),

  // ---- Messages ----
  getMessages: (chatId: number, limit = 50, offset = 0) =>
    request('chats', `/?action=messages&chat_id=${chatId}&limit=${limit}&offset=${offset}`, { method: 'GET' }),

  sendMessage: (chatId: number, text: string) =>
    request('chats', '/?action=messages', {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId, text }),
    }),

  markRead: (chatId: number) =>
    request('chats', '/?action=read', {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId }),
    }),

  sendFileMessage: (chatId: number, text: string, fileUrl: string, fileName: string, type: 'image' | 'file') =>
    request('chats', '/?action=messages', {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId, text, file_url: fileUrl, file_name: fileName, type }),
    }),

  uploadFile: (fileName: string, fileDataB64: string, mimeType: string) =>
    request('upload', '/', {
      method: 'POST',
      body: JSON.stringify({ file_name: fileName, file_data: fileDataB64, mime_type: mimeType }),
    }),

  // ---- Signaling ----
  sendSignal: (callId: string, toUserId: number, type: string, payload: unknown) =>
    request('signal', '/?action=send', {
      method: 'POST',
      body: JSON.stringify({ call_id: callId, to_user_id: toUserId, type, payload }),
    }),

  pollSignals: (afterId: number) =>
    request('signal', `/?action=poll&after_id=${afterId}`, { method: 'GET' }),

  clearSignals: (callId: string) =>
    request('signal', '/?action=clear', {
      method: 'POST',
      body: JSON.stringify({ call_id: callId }),
    }),
};