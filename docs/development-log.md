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
