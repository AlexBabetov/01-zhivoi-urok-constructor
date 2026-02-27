# Агент: Backend

## Роль

Работает с CF Pages Functions, Supabase, переменными окружения и API-эндпоинтами.

## Зона ответственности

- `functions/api/*.js` — все серверные функции
- Supabase: схема таблиц, RLS-политики, запросы
- Переменные окружения в Cloudflare Pages
- Безопасность API: JWT-проверка, rate limiting, whitelist

## CF Pages Functions — паттерны

### Структура функции
```javascript
// functions/api/my-endpoint.js
export async function onRequestPost(context) {
  const { request, env } = context;

  // 1. Проверка JWT (обязательно для всех мутирующих эндпоинтов)
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Unauthorized' }, 401);

  const token = authHeader.replace('Bearer ', '');
  const supabaseUrl = env.SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_KEY;

  const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
  });
  if (!userResp.ok) return json({ error: 'Invalid token' }, 401);
  const user = await userResp.json();

  // 2. Проверка роли
  const role = user.user_metadata?.role;
  if (!['teacher', 'admin'].includes(role)) {
    return json({ error: 'Forbidden' }, 403);
  }

  // 3. Бизнес-логика
  const body = await request.json();
  // ...

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

### Маршрутизация
CF Pages автоматически маппит `functions/api/foo.js` → `GET|POST /api/foo`.
Экспортируй `onRequestGet`, `onRequestPost` и т.д.

## Переменные окружения (runtime, без REACT_APP_)

| Переменная | Используется в |
|-----------|---------------|
| `ANTHROPIC_API_KEY` | `generate-lesson.js` |
| `SUPABASE_URL` | все functions |
| `SUPABASE_SERVICE_KEY` | все functions (service role) |
| `GITHUB_TOKEN` | `save-lesson.js` |
| `GITHUB_REPO` | `save-lesson.js` |

> ⚠️ В старой документации `docs/` упоминается `SUPABASE_SERVICE_ROLE_KEY` и `REACT_APP_SUPABASE_URL` — это Netlify-эра. В CF Pages используй имена выше.

## Supabase через серверные функции

Фронт обращается к Supabase только через `/_supabase/*` (CF proxy) для Auth.
Все данные (уроки, аналитика) — только через `/api/*` функции.

```javascript
// Запрос к Supabase из функции
const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/lessons`, {
  headers: {
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json',
  },
});
```

## Security-блокеры (закрыть в G-001)

1. **`save-lesson.js`** — добавить JWT-проверку (сейчас любой POST пишет в GitHub)
2. **`generate-lesson.js`** — закрепить `AUTH_REQUIRED=true` после пилота
3. **Whitelist моделей** — принимать только `claude-haiku-4-5-20251001`, `claude-sonnet-4-5-20250929`
4. **Rate limiting** — не более 10 генераций/час на пользователя

## Эндпоинты

| Метод | Путь | Функция | Auth |
|-------|------|---------|------|
| POST | `/api/generate-lesson` | Claude API прокси | teacher/admin |
| POST | `/api/save-lesson` | Сохранить в Supabase | teacher/admin |
| GET | `/api/lessons` | Получить уроки пользователя | teacher/admin |
| GET | `/api/get-analytics` | Аналитика | admin |
| GET | `/api/list-pending-users` | Список на одобрение | admin |
| POST | `/api/update-user-status` | Одобрить/заблокировать | admin |
