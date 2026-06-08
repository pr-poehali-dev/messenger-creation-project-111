export type ChatType = 'direct' | 'group' | 'channel';

export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  online: boolean;
  lastSeen?: string;
  bio?: string;
  phone?: string;
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  time: string;
  read: boolean;
  type?: 'text' | 'image' | 'file';
  fileName?: string;
  reactions?: { emoji: string; count: number }[];
}

export interface Chat {
  id: string;
  type: ChatType;
  name: string;
  avatar: string;
  lastMessage: string;
  lastTime: string;
  unread: number;
  online?: boolean;
  members?: number;
  subscribers?: number;
  pinned?: boolean;
}

export const currentUser: User = {
  id: 'me',
  name: 'Алексей Громов',
  username: '@alexgromov',
  avatar: '1',
  online: true,
  bio: 'Разработчик, люблю технологии и кофе ☕',
  phone: '+7 999 123-45-67',
};

export const users: User[] = [
  { id: 'u1', name: 'Мария Соколова', username: '@maria_s', avatar: '2', online: true, bio: 'UI/UX дизайнер', phone: '+7 916 234-56-78' },
  { id: 'u2', name: 'Дмитрий Волков', username: '@dmitry_v', avatar: '3', online: false, lastSeen: '2 ч назад', bio: 'Product Manager', phone: '+7 925 345-67-89' },
  { id: 'u3', name: 'Анна Козлова', username: '@anna_k', avatar: '4', online: true, bio: 'Маркетолог', phone: '+7 903 456-78-90' },
  { id: 'u4', name: 'Иван Новиков', username: '@ivan_n', avatar: '5', online: false, lastSeen: '5 мин назад', bio: 'Backend разработчик', phone: '+7 967 567-89-01' },
  { id: 'u5', name: 'Елена Смирнова', username: '@elena_sm', avatar: '2', online: true, bio: 'Data Analyst', phone: '+7 912 678-90-12' },
  { id: 'u6', name: 'Сергей Лебедев', username: '@sergey_l', avatar: '3', online: false, lastSeen: '1 д назад', bio: 'DevOps инженер', phone: '+7 926 789-01-23' },
  { id: 'u7', name: 'Ольга Петрова', username: '@olga_p', avatar: '4', online: true, bio: 'Контент-менеджер', phone: '+7 977 890-12-34' },
  { id: 'u8', name: 'Никита Орлов', username: '@nikita_o', avatar: '5', online: false, lastSeen: '3 ч назад', bio: 'iOS разработчик', phone: '+7 999 901-23-45' },
];

export const chats: Chat[] = [
  { id: 'c1', type: 'direct', name: 'Мария Соколова', avatar: '2', lastMessage: 'Окей, завтра покажу макеты 🎨', lastTime: '14:32', unread: 3, online: true, pinned: true },
  { id: 'c2', type: 'group', name: 'Команда проекта', avatar: 'group1', lastMessage: 'Дмитрий: Деплой прошёл успешно!', lastTime: '13:15', unread: 12, members: 8 },
  { id: 'c3', type: 'direct', name: 'Иван Новиков', avatar: '5', lastMessage: 'Посмотрел твой PR, есть комменты', lastTime: '12:04', unread: 0, online: false },
  { id: 'c4', type: 'channel', name: 'Tech Новости', avatar: 'channel1', lastMessage: 'OpenAI выпустила новую модель...', lastTime: '11:30', unread: 24, subscribers: 1420 },
  { id: 'c5', type: 'direct', name: 'Анна Козлова', avatar: '4', lastMessage: 'Спасибо за помощь!', lastTime: '10:47', unread: 0, online: true },
  { id: 'c6', type: 'group', name: 'Дизайн & Фронт', avatar: 'group2', lastMessage: 'Ольга: Новые компоненты готовы', lastTime: 'вчера', unread: 5, members: 5 },
  { id: 'c7', type: 'direct', name: 'Елена Смирнова', avatar: '2', lastMessage: 'Данные за прошлую неделю...', lastTime: 'вчера', unread: 0, online: true },
  { id: 'c8', type: 'channel', name: 'Продуктовый дайджест', avatar: 'channel2', lastMessage: 'Топ-10 трендов 2026 года', lastTime: 'пн', unread: 0, subscribers: 8740 },
];

export const messages: Record<string, Message[]> = {
  c1: [
    { id: 'm1', senderId: 'u1', text: 'Привет! Как дела с проектом?', time: '14:10', read: true },
    { id: 'm2', senderId: 'me', text: 'Всё идёт хорошо! Почти закончил главный модуль', time: '14:12', read: true },
    { id: 'm3', senderId: 'u1', text: 'Отлично! А когда сможешь показать промежуточный результат?', time: '14:15', read: true },
    { id: 'm4', senderId: 'me', text: 'Думаю завтра с утра — сделаю ревью и скину тебе ссылку', time: '14:18', read: true },
    { id: 'm5', senderId: 'u1', text: 'Отлично, буду ждать 👍', time: '14:20', read: true },
    { id: 'm6', senderId: 'me', text: 'Кстати, ты уже начала работу над дизайном нового раздела?', time: '14:25', read: true },
    { id: 'm7', senderId: 'u1', text: 'Да! Набросала несколько концепций', time: '14:28', read: true, reactions: [{ emoji: '🔥', count: 2 }] },
    { id: 'm8', senderId: 'u1', text: 'Окей, завтра покажу макеты 🎨', time: '14:32', read: false },
  ],
  c2: [
    { id: 'm1', senderId: 'u2', text: 'Всем привет! Скоро стендап', time: '09:00', read: true },
    { id: 'm2', senderId: 'u4', text: 'Буду готов через 5 минут', time: '09:02', read: true },
    { id: 'm3', senderId: 'u1', text: 'Тоже на месте', time: '09:03', read: true },
    { id: 'm4', senderId: 'me', text: 'Готов!', time: '09:05', read: true },
    { id: 'm5', senderId: 'u2', text: 'Хорошо, начинаем. Вчера завершили спринт, сегодня начинаем новый', time: '09:10', read: true },
    { id: 'm6', senderId: 'u4', text: 'Я взял задачи по API', time: '09:12', read: true },
    { id: 'm7', senderId: 'u2', text: 'Деплой прошёл успешно!', time: '13:15', read: false, reactions: [{ emoji: '🚀', count: 4 }, { emoji: '🎉', count: 3 }] },
  ],
  c3: [
    { id: 'm1', senderId: 'me', text: 'Иван, можешь посмотреть мой PR #47?', time: '11:30', read: true },
    { id: 'm2', senderId: 'u4', text: 'Конечно, дай посмотрю', time: '11:45', read: true },
    { id: 'm3', senderId: 'u4', text: 'Посмотрел твой PR, есть комменты', time: '12:04', read: true },
  ],
  c4: [
    { id: 'm1', senderId: 'channel', text: 'Apple анонсировала новые MacBook Pro с чипом M5 Ultra', time: '09:30', read: true },
    { id: 'm2', senderId: 'channel', text: 'Google DeepMind представила Gemini Ultra 3.0', time: '10:15', read: true },
    { id: 'm3', senderId: 'channel', text: 'OpenAI выпустила новую модель с улучшенным reasoning...', time: '11:30', read: false },
  ],
};
