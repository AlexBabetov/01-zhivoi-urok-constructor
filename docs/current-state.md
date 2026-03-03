---
status: active
created: 2026-02-26
updated: 2026-03-03
owner: babetov_aa@koriphey.ru
tags: [state]
---

# Текущее состояние проекта — Живой урок 360 · Конструктор

Короткий оперативный срез для нового участника и AI-агента.
Это документ состояния, не журнал истории. Обновляется AI-агентом при каждой рабочей сессии.

---

## 1. Статус на 2026-03-03 (сессия 3)

- **G-001 ЗАКРЫТ:** все security-блокеры устранены (JWT, whitelist, rate limiting, аналитика).
- **Платформа:** мигрировали с Netlify на Vercel. Edge Functions в `api/`. Netlify-код архивирован.
- **Admin-панель:** полностью рабочая — заявки, аналитика, дашборд завуча, управление ролями.
- **Приоритет сейчас:** G-002 — первый реальный пилот с Калужской (уроки + рефлексия).
- Дашборд завуча технически готов, но **данных нет** — рефлексий ещё не собрано.

## 2. Что сейчас в работе

- **G-002:** Провести первый урок с kaluzhskaya_mv@koriphey.ru, собрать рефлексию вручную.
- **G-002:** Форма рефлексии после урока (встроить в Шаг 4, данные → Supabase).
- **G-003:** Промпт для средней школы 5–9 кл.

## 3. Ближайший следующий шаг

1. Провести первый урок с Калужской — дать данные в дашборд.
2. Реализовать форму рефлексии (2-минутная, встроена в Шаг 4 конструктора).
3. Зафиксировать ≥ 10 уроков в библиотеке (цель G-002).

## 4. Блокеры и риски

- **Нет данных рефлексий** — дашборд завуча пустой до первых проведённых уроков.
- **RISK:** `src/App.jsx` ~3500+ строк — высокая стоимость любых изменений UI (G-005).
- **MEDIUM:** Нет формы рефлексии после урока — учителя не могут оставить обратную связь.

## 5. Пользователи системы

| Email | Роль | Статус |
|-------|------|--------|
| `alexey@babetov.kz` | admin (superadmin) | active |
| `babetov_aa@koriphey.ru` | admin | active |
| `kamenskih_ig@koriphey.ru` | admin | active |
| `antropova_ts@koriphey.ru` | admin | active |
| `kaluzhskaya_mv@koriphey.ru` | teacher | active |

## 6. Продакшн

- URL: `https://urok360.koriphey.ru`
- Хостинг: **Vercel** (мигрировали с Netlify 2026-03-03)
- Ветка: `main` → Vercel prod autodeploy
- Dev: `https://01-zhivoi-urok-constructor-git-dev-urok360-koriphey.vercel.app` ← ветка `dev`
- Репозиторий: `https://github.com/AlexBabetov/01-zhivoi-urok-constructor`

## 7. Архитектура API (актуальная)

| Файл | Метод | Назначение | Авторизация |
|------|-------|-----------|-------------|
| `api/generate-lesson.js` | POST | Генерация урока (streaming SSE) | Мягкая: гости ок, невалидный токен → 401 |
| `api/save-lesson.js` | POST | Сохранение урока в GitHub | JWT обязателен, status=approved |
| `api/lessons.js` | GET | Список сохранённых уроков | JWT |
| `api/courses.js` | GET | Список курсов | Публичный |
| `api/get-analytics.js` | GET | Аналитика по пользователям | admin/superadmin |
| `api/dashboard.js` | GET | Дашборд завуча | admin/superadmin |
| `api/set-role.js` | POST | Смена роли пользователя | admin/superadmin |
| `api/list-pending-users.js` | GET | Список заявок на регистрацию | admin/superadmin |
| `api/update-user-status.js` | POST | Одобрение/отклонение заявки | admin/superadmin |

## 8. Что не трогать без явного запроса

- `src/App.jsx` — только минимальные фиксы, не рефакторинг (G-005 — отдельная задача)
- `netlify/` — мёртвый код (архив Netlify), не трогать
- `public/curriculum/*.json` — 33 файла учебных программ, не изменять
- `docs/audit-reports/` — исторические отчёты, только добавление
