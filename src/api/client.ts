const URLS = {
  auth: 'https://functions.poehali.dev/2af8a493-4b0f-4728-9b44-595ad8d4e50f',
  chats: 'https://functions.poehali.dev/95f220d4-6f2d-4a0c-94b0-d5b3b286afd3',
  upload: 'https://functions.poehali.dev/a9c74801-66be-4f54-90be-9eab93b57c18',
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
    ...(options.headers as Record<string, string>),
  };
  const sid = getSessionId();
  if (sid) headers['X-Session-Id'] = sid;

  const res = await fetch(url, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
}

// ---- Auth ----
export const api = {
  sendCode: (email: string, name: string, username: string, password: string, phone?: string) =>
    request('auth', '/send-code', {
      method: 'POST',
      body: JSON.stringify({ email, name, username, password, phone }),
    }),

  verifyCode: (email: string, code: string) =>
    request('auth', '/verify-code', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    }),

  register: (name: string, username: string, password: string, phone?: string) =>
    request('auth', '/register', {
      method: 'POST',
      body: JSON.stringify({ name, username, password, phone }),
    }),

  login: (username: string, password: string) =>
    request('auth', '/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request('auth', '/logout', { method: 'POST' }),

  getMe: () =>
    request('auth', '/me', { method: 'GET' }),

  updateMe: (data: { name: string; bio: string; phone: string }) =>
    request('auth', '/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getUsers: (q?: string) =>
    request('auth', '/users' + (q ? `?q=${encodeURIComponent(q)}` : ''), { method: 'GET' }),

  // ---- Chats ----
  getChats: () =>
    request('chats', '/chats', { method: 'GET' }),

  createDirectChat: (otherUserId: number) =>
    request('chats', '/chats', {
      method: 'POST',
      body: JSON.stringify({ type: 'direct', other_user_id: otherUserId }),
    }),

  createGroupChat: (name: string, type: 'group' | 'channel', memberIds: number[]) =>
    request('chats', '/chats', {
      method: 'POST',
      body: JSON.stringify({ type, name, member_ids: memberIds }),
    }),

  // ---- Messages ----
  getMessages: (chatId: number, limit = 50, offset = 0) =>
    request('chats', `/messages?chat_id=${chatId}&limit=${limit}&offset=${offset}`, { method: 'GET' }),

  sendMessage: (chatId: number, text: string) =>
    request('chats', '/messages', {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId, text }),
    }),

  markRead: (chatId: number) =>
    request('chats', '/messages/read', {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId }),
    }),

  sendFileMessage: (chatId: number, text: string, fileUrl: string, fileName: string, type: 'image' | 'file') =>
    request('chats', '/messages', {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId, text, file_url: fileUrl, file_name: fileName, type }),
    }),

  uploadFile: (fileName: string, fileDataB64: string, mimeType: string) =>
    request('upload', '/', {
      method: 'POST',
      body: JSON.stringify({ file_name: fileName, file_data: fileDataB64, mime_type: mimeType }),
    }),
};