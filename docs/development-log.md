---
status: active
created: 2026-02-20
updated: 2026-02-26
owner: babetov_aa@koriphey.ru
tags:
  - devlog
---

# Development Log — Живой урок 360 · Конструктор

Канонический лог разработки проекта. Ведётся AI-агентом, контролируется человеком.

Продакшн: `https://urok360.koriphey.ru`
Репозиторий: `https://github.com/AlexBabetov/01-zhivoi-urok-constructor`

---

<!-- AI RULES:
  - Добавлять записи СНИЗУ внутри текущей версии
  - Формат записи: - [x] id:YYYYMMDD-HHMMSS | тип | описание | email | СТАТУС
  - Типы: setup, feature, fix, docs, audit, security, chore
  - Статусы: DONE, REVIEW, REJECTED
  - При старте новой версии — добавить секцию ## v{N} с датой и кратким описанием
  - Не удалять выполненные записи
-->

---

## v1 — Инфраструктура и аутентификация (20–25 февраля 2026)

Перенос проекта в организацию, настройка деплоя, полный цикл аутентификации,
административная панель, аналитика, кастомный домен.

### 2026-02-20 — Инфраструктура GitHub

- [x] id:20260220-000000 | setup | Создана организация koriphey-org в GitHub. Структура репозиториев: 00-knowledge-base, 01-zhivoi-urok-constructor, 02-methodology, 03-pilot-russian-2grade | babetov_aa@koriphey.ru | DONE
- [x] id:20260220-000001 | setup | Перенос кода конструктора v2.5 из личного репозитория в 01-zhivoi-urok-constructor/, история коммитов сохранена | babetov_aa@koriphey.ru | DONE
- [x] id:20260220-000002 | setup | Netlify подключён к ветке main репозитория AlexBabetov/01-zhivoi-urok-constructor. Продакшн-URL: constructor-zhivoi-urok.netlify.app. Функции esbuild | babetov_aa@koriphey.ru | DONE

### 2026-02-21/22 — Dev-ветка и среда разработки

- [x] id:20260221-000000 | setup | Создана ветка dev. Netlify: пуш в dev → dev--constructor-zhivoi-urok.netlify.app. Все тесты на dev, в main — только проверенный код | babetov_aa@koriphey.ru | DONE
- [x] id:20260221-000001 | setup | Создан netlify.toml: настройки функций (esbuild), redirects для SPA, конфигурация branch deploys | babetov_aa@koriphey.ru | DONE

### 2026-02-23/24 — Аутентификация Supabase

- [x] id:20260223-000000 | setup | Создан проект Supabase wogcofceyeeouxokzpqy. Plan: Free, регион: EU Central. Настроена аутентификация email+password | babetov_aa@koriphey.ru | DONE
- [x] id:20260223-000001 | feature | Создан AuthGate.jsx — оборачивает приложение, без сессии показывает LoginScreen | babetov_aa@koriphey.ru | DONE
- [x] id:20260223-000002 | feature | Добавлен RegisterScreen: email, пароль, имя, школа, город. После отправки статус = pending, вход запрещён до одобрения admin | babetov_aa@koriphey.ru | DONE
- [x] id:20260223-000003 | feature | Реализованы роли teacher и admin. Роль хранится в user_metadata.role в Supabase Auth | babetov_aa@koriphey.ru | DONE
- [x] id:20260224-000000 | security | save-lesson.js обновлён: JWT-верификация через Supabase Admin API, добавлены author_id и author_email в meta и index.json. Без токена — 401 | babetov_aa@koriphey.ru | DONE

### 2026-02-24 — Административная панель и уведомления

- [x] id:20260224-000001 | feature | Создана AdminView.jsx: кнопка Заявки в хедере (только admin), список pending-пользователей с кнопками Одобрить/Отклонить | babetov_aa@koriphey.ru | DONE
- [x] id:20260224-000002 | feature | Netlify function list-pending-users: список pending через JWT-проверку admin | babetov_aa@koriphey.ru | DONE
- [x] id:20260224-000003 | feature | Netlify function update-user-status: смена статуса approved/rejected, email-уведомление учителю при одобрении | babetov_aa@koriphey.ru | DONE
- [x] id:20260224-000004 | feature | Netlify function notify-admin: письмо на ADMIN_EMAIL через Resend API при новой регистрации | babetov_aa@koriphey.ru | DONE
- [x] id:20260224-000005 | setup | Resend API: домен koriphey.ru верифицирован, DNS (DKIM, MX, SPF) в NetAngels, письма с info@koriphey.ru | babetov_aa@koriphey.ru | DONE
- [x] id:20260224-000006 | setup | Все 7 env vars добавлены в Netlify: ANTHROPIC_API_KEY, GITHUB_REPO, GITHUB_TOKEN, REACT_APP_SUPABASE_ANON_KEY, REACT_APP_SUPABASE_URL, RESEND_API_KEY, SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL | babetov_aa@koriphey.ru | DONE

### 2026-02-25 — Кастомный домен, аналитика, исправления

- [x] id:20260225-000000 | setup | Кастомный домен urok360.koriphey.ru: CNAME в NetAngels, SSL Let's Encrypt, редирект со старого netlify-адреса | babetov_aa@koriphey.ru | DONE
- [x] id:20260225-000001 | fix | Site URL в Supabase исправлен с localhost:3000 на https://urok360.koriphey.ru. Добавлены Redirect URLs для prod и dev | babetov_aa@koriphey.ru | DONE
- [x] id:20260225-000002 | feature | Создана таблица public.lesson_events (id, created_at, user_id, user_email, event_type, subject, grade, lesson_title, lesson_id). RLS включена, индексы по user_id и created_at | babetov_aa@koriphey.ru | DONE
- [x] id:20260225-000003 | feature | generate-lesson.js: JWT-идентификация пользователя, запись события generated в lesson_events | babetov_aa@koriphey.ru | DONE
- [x] id:20260225-000004 | feature | save-lesson.js: запись события saved в lesson_events после успешного сохранения в GitHub | babetov_aa@koriphey.ru | DONE
- [x] id:20260225-000005 | feature | Netlify function get-analytics: только admin, сводка по пользователям/генерациям/сохранениям, последние 20 событий | babetov_aa@koriphey.ru | DONE
- [x] id:20260225-000006 | feature | AdminView.jsx переработан: вкладки Заявки и Аналитика. 4 карточки-метрики, таблица пользователей, лента событий | babetov_aa@koriphey.ru | DONE

---

## v2 — Документация, аудит, AI-управление (26 февраля 2026)

Введено явное AI-управление проектом. Первичный аудит системы.
Создана документационная инфраструктура.

### 2026-02-26 — Аудит и документация

- [x] id:20260226-120000 | audit | Первичный аудит системы v2.5: архитектура, безопасность, data flow, промпты, контент, ops — два независимых аналитика + сопоставление | babetov_aa@koriphey.ru | DONE
- [x] id:20260226-120100 | setup | Создан AGENTS.md в корне проекта — точка входа для AI-агентов | babetov_aa@koriphey.ru | DONE
- [x] id:20260226-120200 | setup | Создана структура docs/ с папками audit-reports/ и specs/ | babetov_aa@koriphey.ru | DONE
- [x] id:20260226-120300 | audit | Создан docs/audit-reports/system-health-2026-02-26.md — сводный отчёт: оценка 4/10, 3 критических блокера | babetov_aa@koriphey.ru | DONE
- [x] id:20260226-120400 | docs | Создан docs/roadmap-goals.md — дорожная карта G-001..G-006 | babetov_aa@koriphey.ru | DONE
- [x] id:20260226-121000 | fix | Перенесены docs/_docs/ → docs/: удалена лишняя папка _docs, зафиксировано исключение из глобального стандарта | babetov_aa@koriphey.ru | DONE
- [x] id:20260226-121100 | docs | AGENTS.md обновлён: исключение docs/ без underscore, запрет _docs/ в этом проекте | babetov_aa@koriphey.ru | DONE
- [x] id:20260226-130000 | docs | Создан development-log.md: канонический devlog. v1 перенесён из devlog-feb2026.docx, v2 начат. activity-log.md упразднён | babetov_aa@koriphey.ru | DONE
- [x] id:20260226-140000 | docs | roadmap-goals.md консолидирован: добавлены quality gates, depends_on, контекст к каждой цели, новая G-007 AI-управление (вдохновение UAP). Исправлена ошибка AGENTS.md строка 93: activity-log.md → development-log.md | babetov_aa@koriphey.ru | DONE
- [x] id:20260226-140100 | docs | Создана docs/refs/uap-architecture-review.md — архив UAP Architecture Review Request для ссылки из G-007 | babetov_aa@koriphey.ru | DONE
- [x] id:20260226-150000 | docs | roadmap-goals.md v3: консолидация с roadmap-2026.docx. Добавлены метрики KPI, G-003 (качество/промпты), G-004 (масштабирование 5-10 учителей), G-008 (AI-коуч + монетизация), ближайшие 3 действия. Перенумерация G-005..G-009. Оригинал → docs/refs/roadmap-2026.docx | babetov_aa@koriphey.ru | DONE
- [x] id:20260226-093005 | docs | Ребилд модели AI-управления по стандарту 00-koriphey-knowledge-base: созданы CLAUDE.md (точка входа для Claude Code/Cowork), docs/project-rules.md (правила проекта, 100% приоритет), docs/current-state.md (оперативный срез), .env.example (канонический список переменных), docs/team/ (карточки babetov_aa.md, kaluzhskaya_mv.md). Добавлен frontmatter во все docs/*.md без него. docs/refs/roadmap-2026.docx → archive-roadmap-2026.docx (данные уже в roadmap-goals.md). | babetov_aa@koriphey.ru | DONE
- [x] id:20260226-093658 | audit | Полный аудит кода проекта (сессия 2): прочитаны App.jsx, netlify/functions/*, netlify/edge-functions/generate-lesson.js, netlify.toml, public/curriculum/ (33 файла). Новые находки: (1) edge-functions/generate-lesson.js — публичный прокси без JWT [CRITICAL], (2) Edge принимает model+max_tokens без валидации [CRITICAL], (3) Edge default model claude-3-5-haiku-20241022 устарел [BUG], (4) save-lesson.js читает SUPABASE_URL — расхождение с env vars [BUG], (5) 6 предметов в UI без curriculum: Английский, Немецкий, Французский, МХК, Биология 10-11, Информатика 10-11. Обновлены: project-rules.md, current-state.md, roadmap-goals.md (G-001 +4 задачи, G-009 +2 задачи), AGENTS.md (порядок чтения, структура docs/, секция известных проблем), .env.example (+SUPABASE_URL). | babetov_aa@koriphey.ru | DONE
- [x] id:20260226-094007 | docs | Финализация документации сессии 2: закрыты выполненные задачи G-009 в roadmap-goals.md (.env.example обновлён, ссылка на archive-roadmap-2026.docx исправлена). Все изменения из системных уведомлений линтера приняты. | babetov_aa@koriphey.ru | DONE

---

## v3 — Миграция на Vercel, Admin-панель, Дашборд завуча, Rate limiting (3 марта 2026)

Полная миграция с Netlify на Vercel. Все security-блокеры G-001 закрыты.
Реализован дашборд завуча с управлением ролями. Назначены три администратора.

### 2026-03-03 — Миграция с Netlify на Vercel

- [x] id:20260303-100000 | setup | Проект перенесён с Netlify на Vercel: создана папка api/ с Vercel Edge Functions. Netlify-специфичный код (netlify/functions/, netlify.toml) оставлен как архив. Autodeploy: main → prod, dev → preview | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-100100 | setup | Все env vars перенесены в Vercel: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY, GITHUB_REPO, GITHUB_TOKEN, RESEND_API_KEY | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-100200 | fix | Исправлены Redirect URLs в Supabase Auth: добавлены prod и dev Vercel-адреса | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-100300 | fix | Библиотека курсов: исправлен фетч /courses/index.json — вкладка «Курсы» заработала | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-100400 | fix | Таймер генерации: метка «Claude» переименована в «AI» | babetov_aa@koriphey.ru | DONE

### 2026-03-03 — Закрытие G-001: security-блокеры

- [x] id:20260303-110000 | security | api/generate-lesson.js: JWT-верификация (мягкая — гости допускаются, невалидный токен → 401). Авторизованные запросы логируются в lesson_events | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-110100 | security | api/generate-lesson.js: whitelist моделей ALLOWED_MODELS, потолок max_tokens=10000, default model → claude-haiku-4-5-20251001 | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-110200 | security | api/generate-lesson.js: логирование события generated перенесено в Vercel Edge Function (best-effort для авторизованных и гостей по IP) | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-110300 | security | api/generate-lesson.js: rate limiting — учитель 5/день, admin 10/день, гость 2/день по IP. При превышении → 429 с человеческим сообщением на русском | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-110400 | fix | App.jsx: ошибки API теперь парсят JSON-поле error — учитель видит русский текст вместо технического JSON при ошибках сервера | babetov_aa@koriphey.ru | DONE

### 2026-03-03 — Admin-панель и дашборд завуча

- [x] id:20260303-120000 | docs | Создан docs/specs/spec-dashboard-zavuch.md — полный PRD: проблема, user stories, must have/should have, API spec, SQL, критерии приёмки, метрики, оценка ~7ч | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-120100 | setup | Создан supabase/migrations/20260304_create_lesson_events.sql — идемпотентная миграция, добавлены индексы по event_type и subject (таблица уже существовала) | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-120200 | feature | Создан api/get-analytics.js: GET /api/get-analytics?days=N, только admin/superadmin. Список всех пользователей через Supabase Admin API, агрегат lesson_events за период, email виден только суперадмину | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-120300 | feature | Создан api/dashboard.js: GET /api/dashboard?days=N, только admin/superadmin. Параллельный запрос reflections_by_teacher + reflections_by_subject + recent reflections | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-120400 | feature | Создан api/set-role.js: POST {userId, role}, только admin/superadmin. Защита от смены собственной роли. superadmin может назначать superadmin, admin — только teacher/admin | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-120500 | fix | Создан api/list-pending-users.js: GET, фильтр status=pending через Supabase Admin API. Исправляет 404 в вкладке «Заявки» | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-120600 | fix | Создан api/update-user-status.js: POST {userId, status, userEmail, userName}. Merge user_metadata (не перезаписывает role). Email-уведомление через Resend | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-120700 | feature | AdminView.jsx: вкладка «🏫 Дашборд» (DashboardTab) — summary cards, таблица по предметам с красной подсветкой avg_rating<3, таблица по учителям, переключатель 7/30/90 дней | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-120800 | feature | AdminView.jsx: вкладка «👤 Роли» (UsersTab) — поиск по имени/email, бейджи ролей с цветами, кнопки «→ Учитель» / «→ Админ», оптимистичное обновление, email и город видны всем admin | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-120900 | fix | App.jsx: кнопка admin переименована «👥 Заявки» → «🛡️ Панель» для ясности | babetov_aa@koriphey.ru | DONE

### 2026-03-03 — Пользователи и мерж

- [x] id:20260303-130000 | chore | Назначены роли admin: kamenskih_ig@koriphey.ru и babetov_aa@koriphey.ru через SQL, antropova_ts@koriphey.ru через UI-панель «👤 Роли» (первое использование панели в продакшне) | babetov_aa@koriphey.ru | DONE
- [x] id:20260303-130100 | chore | dev → main: смерж после стабилизации security и admin-панели | babetov_aa@koriphey.ru | DONE
