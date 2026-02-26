---
status: active
created: 2026-02-26
updated: 2026-02-26
owner: babetov_aa@koriphey.ru
tags: [state]
---

# Текущее состояние проекта — Живой урок 360 · Конструктор

Короткий оперативный срез для нового участника и AI-агента.
Это документ состояния, не журнал истории. Обновляется AI-агентом при каждой рабочей сессии.

---

## 1. Статус на 2026-02-26 (сессия 2)

- **Фаза 1 завершена:** инфраструктура, аутентификация, аналитика, кастомный домен.
- **Фаза 2 в работе:** закрытие security-блокеров (G-001), первый пилот (G-002).
- Оценка по аудиту: **2/10** — не production-ready без закрытия блокеров.
- Модель AI-управления введена полностью: CLAUDE.md, AGENTS.md, docs/ (project-rules, current-state, roadmap, devlog, team, .env.example).

## 2. Что сейчас в работе

- G-001: security-блокеры (JWT в save-lesson + edge generate-lesson, whitelist моделей, rate limiting, аналитика).

## 3. Ближайший следующий шаг

1. JWT-верификация в `save-lesson.js` — CRITICAL (DDoS + порча репо).
2. JWT-верификация в `netlify/edge-functions/generate-lesson.js` — CRITICAL (публичный прокси к Anthropic).
3. Server-side whitelist моделей + `max_tokens` ceiling в Edge Function.
4. Логирование `generated` перенести в Edge Function; dead code Regular Function → задокументировать как non-production.
5. Добавить `SUPABASE_URL` в Netlify env vars (отдельно от `REACT_APP_SUPABASE_URL`).

## 4. Блокеры и риски

- **CRITICAL:** `save-lesson.js` — нет JWT → любой POST пишет в GitHub + триггерит Netlify deploy.
- **CRITICAL:** `edge-functions/generate-lesson.js` — публичный прокси к Anthropic API без аутентификации.
- **CRITICAL:** Edge принимает `model` и `max_tokens` от клиента без валидации — можно подставить дорогую модель.
- **HIGH:** Аналитика генераций мертва — `generated` пишется в мёртвый Regular Function, не в Edge.
- **HIGH:** Нет rate limiting на `/api/generate-lesson`.
- **BUG:** `save-lesson.js` читает `process.env.SUPABASE_URL`, но в Netlify переменная — `REACT_APP_SUPABASE_URL`. Логирование `saved` в Supabase не работает.
- **BUG:** Edge default model `claude-3-5-haiku-20241022` устарел; клиент переопределяет правильно (`claude-haiku-4-5-20251001`), но прямые вызовы Edge используют устаревший.
- **RISK:** `src/App.jsx` 2104 строки — высокая стоимость любых изменений UI.

## 5. Пользователи системы

| Email | Роль | Статус |
|-------|------|--------|
| `babetov_aa@koriphey.ru` | admin | active |
| `kaluzhskaya_mv@koriphey.ru` | teacher | active |

## 6. Продакшн

- URL: `https://urok360.koriphey.ru`
- Ветка: `main` → Netlify autodeploy
- Dev: `dev--constructor-zhivoi-urok.netlify.app` ← ветка `dev`

## 7. Что не трогать без явного запроса

- `src/App.jsx` — только минимальные фиксы, не рефакторинг
- `netlify/functions/generate-lesson.js` — мёртвый код, не трогать
- `public/curriculum/*.json` — 33 файла учебных программ, не изменять
- `docs/audit-reports/` — исторические отчёты, только добавление
