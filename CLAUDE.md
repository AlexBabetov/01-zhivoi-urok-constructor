# Живой урок 360 — Конструктор уроков

## Продукт

Веб-приложение для учителей: конструктор интерактивных
уроков с AI-генерацией контента по методологии «Живой урок 360».

## Репозиторий

- GitHub: `AlexBabetov/01-zhivoi-urok-constructor` (ветка `main`)
- Деплой: Cloudflare Pages → `urok360.koriphey.ru`
- Автодеплой: каждый push в `main` → CF Pages `urok360-git`

## Стек

- **Frontend**: React 18 (CRA), Supabase Auth, чистый CSS
- **Backend**: Cloudflare Pages Functions (Node.js) в `/functions/api/`
- **AI**: Anthropic Claude API (`generate-lesson.js`)
- **БД**: Supabase (PostgreSQL)
- **Хостинг**: Cloudflare Pages

## Ключевые файлы

- `src/App.jsx` — корневой компонент
- `src/AuthGate.jsx` — авторизация
- `src/AdminView.jsx` — управление пользователями
- `functions/api/generate-lesson.js` — AI генерация
- `functions/api/save-lesson.js` — сохранение уроков
- `functions/api/lessons.js` — получение уроков
- `functions/api/get-analytics.js` — аналитика
- `functions/api/list-pending-users.js` — список пользователей
- `functions/api/update-user-status.js` — статус пользователей
- `public/curriculum/` — JSON учебных программ

## Соглашения

- Все изменения только через ветки, не в `main` напрямую
- Каждая функция CF Pages — один файл, одна ответственность
- Supabase запросы только через серверные функции, не из фронта

## Агенты

Специализированные инструкции в `agents/<роль>/CLAUDE.md`:

- `agents/architect/` — архитектурные решения и планирование
- `agents/frontend/` — React-компоненты и UI
- `agents/backend/` — CF Pages Functions и Supabase
- `agents/ai/` — Claude API, промпты, методология ЖУ360
