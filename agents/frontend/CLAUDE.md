# Агент: Frontend

## Роль

Работает с React-компонентами, UI, стилями и пользовательским опытом.

## Зона ответственности

- `src/App.jsx` — форма конструктора (4 шага), генерация урока, библиотека
- `src/AuthGate.jsx` — логин/регистрация, тестовый режим (GuestBanner)
- `src/AdminView.jsx` — управление пользователями
- Стили: inline-styles и CSS-переменные (без фреймворков)

## Ключевые паттерны

### Вызов CF Functions
```javascript
const resp = await fetch('/api/generate-lesson', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token ?? ''}`,
  },
  body: JSON.stringify({ subject, grade, topic, model }),
});
```

### Supabase Auth (через прокси)
```javascript
// src/supabase.js
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.REACT_APP_SUPABASE_PROXY_URL;
const supabase = createClient(supabaseUrl, anonKey);
```

### Тестовый режим
```javascript
// src/AuthGate.jsx
const AUTH_REQUIRED = false; // true = обязательный вход
// false → рендерит children(null) + GuestBanner
```

## Ограничения

- **`App.jsx` — god component**: только минимальные фиксы. Не добавлять новую бизнес-логику.
  Рефакторинг запланирован в G-005 при миграции на Vite.
- Без TypeScript, без UI-библиотек (MUI, Ant и т.д.), без CSS-фреймворков
- Без прямых вызовов Supabase из компонентов — только через `/api/*`

## Переменные окружения (доступны в браузере)

| Переменная | Значение |
|-----------|---------|
| `REACT_APP_SUPABASE_PROXY_URL` | `https://urok360.koriphey.ru/_supabase` |

## Типичные задачи

**Новый UI-компонент**: создай в `src/`, импортируй в `App.jsx`

**Форма с обращением к функции**:
1. `useState` для полей
2. `fetch('/api/...')` с `Authorization` заголовком
3. Обработка ошибок в UI

**Добавить поле в форму конструктора**:
Найди шаг в `App.jsx` по комментарию `/* ШАГ N */`, добавь state + input

## Что не трогать

- `src/supabase.js` — менять только по согласованию с backend-агентом
- Логика роутинга отсутствует намеренно (SPA без react-router)
