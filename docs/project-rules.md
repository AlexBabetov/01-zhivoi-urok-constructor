---
status: active
created: 2026-02-26
updated: 2026-02-26
owner: babetov_aa@koriphey.ru
tags: [rules, project]
---

# Локальные правила проекта — 01-zhivoi-urok-constructor

Локальный слой правил для репозитория `01-zhivoi-urok-constructor`.

Базовый канон экосистемы: `https://github.com/koriphey-org/00-koriphey-knowledge-base/blob/main/_docs/global-rules.md`
При конфликте локального и глобального правила для этого репозитория приоритет у этого файла.

---

## 1. Исключения из глобального канона

| Правило | Глобально | В этом проекте | Причина |
|---------|-----------|----------------|---------|
| Папка документации | `_docs/` | `docs/` | Проект существовал до введения стандарта `_docs/`; переименование сломает ссылки |
| Скиллы AI | `_skills/` | не используется | Проект кодовый, не контентный |

**Создание `_docs/` в этом проекте запрещено.**

---

## 2. Стек и архитектурные решения

### Принятые решения (не пересматривать без явного запроса)

- **React 18 (CRA)** — технический долг, но менять до v3.0 нецелесообразно. Миграция на Vite запланирована в G-005.
- **GitHub как хранилище уроков** — намеренное решение, даёт версионирование контента без отдельной БД.
- **Supabase Auth** — аутентификация + аналитика (`lesson_events`). Хранилище данных пользователей.
- **Netlify Edge Function** (`netlify/edge-functions/generate-lesson.js`) для `/api/generate-lesson` — боевой путь SSE-стриминга. Regular Function `netlify/functions/generate-lesson.js` — мёртвый код, никогда не вызывается.
- **Resend** — email-уведомления с домена `koriphey.ru`.
- **`src/App.jsx` — god component** — временное состояние. Рефакторинг запланирован в G-005.

### Запрещённые паттерны

- Не писать новую бизнес-логику в `App.jsx` — только минимальные фиксы до рефакторинга.
- Не создавать Regular Functions для задач, требующих SSE или > 10 сек выполнения — только Edge.
- Не хардкодить модели Claude — модель передаётся параметром.
- Не добавлять `.docx`, `.txt` файлы в `docs/` — только `.md`.
- Не писать нормативные правила вне `docs/project-rules.md`.

---

## 3. Именование файлов

- Только `kebab-case`: строчные, дефисы, без пробелов, без кириллицы.
- Расширение: только `.md` для документации.
- Исключения верхнего регистра: `AGENTS.md`, `CLAUDE.md`, `README.md`.
- Временны́е отчёты: паттерн `{slug}-YYYY-MM-DD.md`.

---

## 4. Frontmatter

Обязательный минимум для всех `.md` файлов в `docs/`:

```yaml
---
status: active | archive
created: YYYY-MM-DD
updated: YYYY-MM-DD
owner: email@koriphey.ru
tags: [тег1, тег2]
---
```

---

## 5. Переменные окружения

Канонический список: `.env.example` в корне репозитория.
Задаются в Netlify → Site settings → Environment variables.
`REACT_APP_*` дублируются в `netlify.toml` [build.environment] — это нормально для CRA.

⚠️ **Известное расхождение:** `save-lesson.js` читает `process.env.SUPABASE_URL`, но в `.env.example` и Netlify эта переменная называется `REACT_APP_SUPABASE_URL`. Добавить `SUPABASE_URL` как отдельную серверную переменную (без `REACT_APP_` префикса).

| Переменная | Где используется |
|------------|-----------------|
| `ANTHROPIC_API_KEY` | Edge Function: generate-lesson (через `Deno.env.get`) |
| `GITHUB_TOKEN` | Function: save-lesson |
| `GITHUB_REPO` | Function: save-lesson |
| `REACT_APP_SUPABASE_URL` | Frontend: AuthGate + netlify.toml |
| `REACT_APP_SUPABASE_ANON_KEY` | Frontend: AuthGate + netlify.toml |
| `SUPABASE_URL` | Function: save-lesson (серверная, без REACT_APP_ префикса) |
| `SUPABASE_SERVICE_ROLE_KEY` | Functions: list-pending-users, update-user-status, save-lesson |
| `RESEND_API_KEY` | Functions: notify-admin, update-user-status |
| `ADMIN_EMAIL` | Functions: notify-admin |

---

## 6. Работа с ветками

- `main` — только проверенный код, автодеплой на `urok360.koriphey.ru`
- `dev` — рабочая ветка, автодеплой на `dev--constructor-zhivoi-urok.netlify.app`
- Все изменения через `dev` → PR → `main`

---

## 7. Известные проблемы (на 2026-02-26)

Полный аудит: `docs/audit-reports/system-health-2026-02-26.md`

**CRITICAL:**
1. `save-lesson.js` — нет JWT-проверки (любой POST пишет в GitHub + триггерит deploy)
2. `edge-functions/generate-lesson.js` — публичный прокси к Anthropic API без JWT-проверки
3. Edge Function принимает `model` и `max_tokens` от клиента без валидации (нет whitelist)

**HIGH:**
4. Аналитика генераций мертва: `generated` пишется в Regular Function, боевой путь — Edge (без логирования)
5. Нет rate limiting на `/api/generate-lesson`
6. `SUPABASE_URL` в `save-lesson.js` — расхождение с именем переменной `REACT_APP_SUPABASE_URL`
7. Edge default model: `claude-3-5-haiku-20241022` (устаревший) — клиент переопределяет `claude-haiku-4-5-20251001`, но при прямом вызове Edge используется устаревший

**CURRICULUM пробелы (нет программного контекста):**
- Английский язык 2–11 кл. (предмет виден в UI, файла нет)
- Немецкий язык 2–11 кл.
- Французский язык 2–11 кл.
- МХК 8–11 кл.
- Биология 10–11 кл. (есть только `biology-5-9.json`)
- Информатика 10–11 кл. (есть только `informatika-7-9.json`)

---

## 8. Порядок чтения для AI-агента

1. `CLAUDE.md` или `AGENTS.md` — точка входа
2. `docs/project-rules.md` — этот файл
3. `docs/current-state.md` — актуальное состояние
4. `docs/roadmap-goals.md` — цели и приоритеты
5. Хвост `docs/development-log.md` — последний контекст
