# Дашборд завуча — Feature Spec

**Фаза:** Sprint 4 (май 2026)
**Приоритет:** 🟡 Важно
**Статус:** Draft — март 2026
**Зависимость:** Требует завершения Sprint 3 (рефлексии сохраняются в Supabase)

---

## Проблема

Завуч не видит картину работы учителей с конструктором: кто генерирует уроки, кто их реально проводит, каков средний рейтинг уроков по предмету, где есть проблемы с таймингом. Всё это есть в базе — в таблицах `lesson_events` и `reflections` — но никакого интерфейса нет.

**Для кого проблема:**
- **Завуч** не может отследить, какие учителя используют конструктор, а какие — нет.
- **Методист Корифея** не видит агрегированных данных о качестве уроков по предмету и классу.
- **Директор** хочет понять ROI внедрения конструктора — сколько уроков сгенерировано и проведено.

---

## Решение

Отдельный экран `/admin` (доступен только пользователям с `role = 'admin'` или `'superadmin'` в `user_metadata`), который агрегирует данные из Supabase и показывает:

1. **Сводку по школе** — уроки сгенерированы / сохранены / проведены за период.
2. **Активность учителей** — таблица: учитель → количество уроков → рефлексии → средний рейтинг → последняя активность.
3. **Аналитику по предметам** — средний рейтинг, типичное настроение (mood), проблемы с таймингом.
4. **Рефлексии учителей** — последние 20 рефлексий в хронологическом порядке.

---

## User Stories

- Как **завуч**, я хочу войти в `/admin` и увидеть сводку по школе за последний месяц, чтобы понять, насколько активно учителя используют конструктор.
- Как **завуч**, я хочу видеть таблицу учителей с количеством уроков и средним рейтингом, чтобы выявить тех, кто нуждается в поддержке.
- Как **завуч**, я хочу фильтровать данные по предмету и классу, чтобы сосредоточиться на конкретной параллели.
- Как **методист Корифея**, я хочу видеть, по каким предметам уроки получают низкий рейтинг, чтобы скорректировать промпты и методические материалы.
- Как **суперадмин**, я хочу выбрать период (7 дней / 30 дней / 90 дней), чтобы смотреть тренды.

---

## Требования

### Must Have (MVP)

**Доступ и роль:**
- [ ] Маршрут `/admin` через `window.location.pathname === '/admin'` (без Router, аналогично `/library`)
- [ ] `AdminView` рендерится только если `user?.user_metadata?.role` входит в `['admin', 'superadmin']`
- [ ] Если авторизованный пользователь без роли admin — редирект/заглушка «Недостаточно прав»
- [ ] Если не авторизован — редирект на логин

**Сводка (Summary Cards):**
- [ ] «Уроков сгенерировано» — count `lesson_events` где `event_type = 'generated'` за период
- [ ] «Уроков сохранено» — count `lesson_events` где `event_type = 'saved'` за период
- [ ] «Рефлексий заполнено» — count `reflections.saved_at` за период
- [ ] «Учителей активных» — distinct `user_id` из `lesson_events` за период

**Таблица учителей:**
- [ ] `user_id`, `total_lessons` (generated), `saved_lessons`, `total_reflections`, `avg_rating`, `last_reflection_at`
- [ ] Источник: `reflections_by_teacher` view + join с `lesson_events`
- [ ] Email учителя НЕ показывается в интерфейсе (только UUID или ник); исключение — суперадмин
- [ ] Сортировка по умолчанию: по `last_reflection_at` (самые активные сверху)

**Аналитика по предметам:**
- [ ] Источник: `reflections_by_subject` view (уже есть в Supabase)
- [ ] Таблица: предмет, класс, всего уроков, средний рейтинг, типичный mood, типичный wellbeing
- [ ] Подсветить строки с `avg_rating < 3.0` красным (проблемные предметы)

**Фильтр периода:**
- [ ] Переключатель: **7 дней / 30 дней / 90 дней** (по умолчанию 30 дней)
- [ ] Параметр `?days=30` в URL для кнопки «Поделиться»

**Backend:**
- [ ] Новая Vercel Edge Function `api/dashboard.js`
- [ ] Требует JWT авторизации (роль admin/superadmin) — иначе 403
- [ ] Запрашивает Supabase service role: `lesson_events`, `reflections_by_teacher`, `reflections_by_subject`
- [ ] Возвращает агрегированные данные за `?days=N`

### Should Have (Sprint 4+)

- [ ] **Email учителя для суперадмина** — показывать в отдельной колонке при `role = 'superadmin'`
- [ ] **Фильтр по предмету** — выпадающий список, фильтрует таблицу учителей и рефлексии
- [ ] **Фильтр по классу** — аналогично
- [ ] **Последние рефлексии** — лента последних 20 записей с предметом, классом, темой, рейтингом и mood
- [ ] **Прогресс курса «Логика Корифей»** — сколько учителей ставили рефлексии на занятия по логике (через `notes` или отдельное поле)
- [ ] **Экспорт в CSV** — кнопка «Скачать отчёт» для завуча
- [ ] **График активности** — простой SVG/Chart.js bar chart уроков по неделям

### Won't Have (v1)

- Индивидуальные уведомления учителям от завуча
- Сравнение учителей между собой (рейтинговая таблица)
- Данные по конкретным урокам (только агрегат)
- Редактирование рефлексий учителей из дашборда
- Многошкольный режим (пока одна школа/инстанс)

---

## Технические детали

### 1. Supabase — существующая инфраструктура ✅

Уже есть (миграция `20260302_create_reflections.sql`):

```sql
-- Таблица рефлексий
create table public.reflections (
  id text primary key,   -- subject-grade-topic (уникален для учитель+урок)
  user_id uuid references auth.users(id),
  subject text, grade smallint, topic text,
  rating smallint,       -- 1..5
  timing text,           -- 'ok' | '5min' | 'long'
  mood text,             -- 'low' | 'work' | 'active' | 'fire'
  wellbeing text,        -- 'tired' | 'ok' | 'good' | 'excited' | 'mixed'
  capture_used text,     -- '0'..'3'
  notes text,
  saved_at timestamptz,
  updated_at timestamptz
);

-- Вьюхи (уже созданы):
-- reflections_by_teacher — агрегат по user_id
-- reflections_by_subject — агрегат по subject + grade

-- RLS: учитель видит только свои, admin видит все
```

Таблица `lesson_events` (из `generate-lesson.js`):
```sql
-- Предполагаем существующую структуру (создать миграцию если нет):
create table if not exists public.lesson_events (
  id          bigserial primary key,
  user_id     uuid references auth.users(id),
  user_email  text,
  event_type  text check (event_type in ('generated', 'saved')),
  subject     text,
  grade       smallint,
  lesson_title text,
  lesson_id   text,
  created_at  timestamptz default now()
);
create index on public.lesson_events(user_id);
create index on public.lesson_events(created_at desc);
create index on public.lesson_events(event_type);
```

### 2. Новая функция `api/dashboard.js`

```js
export const config = { runtime: 'edge' };

// GET /api/dashboard?days=30
// Authorization: Bearer <jwt> — обязателен, role = admin | superadmin

export default async function handler(req) {
  // 1. Верифицировать JWT (аналогично generate-lesson.js)
  //    Если нет токена или роль не admin/superadmin → 403

  // 2. Получить days = parseInt(url.searchParams.get('days')) || 30
  //    Ограничить: Math.min(days, 365)
  //    since = new Date(Date.now() - days * 86400000).toISOString()

  // 3. Запросить Supabase через service role key:
  //    a) lesson_events WHERE created_at >= since
  //       → aggregated: generated_count, saved_count, active_teachers (distinct user_id)
  //    b) reflections WHERE saved_at >= since
  //       → count, avg_rating
  //    c) reflections_by_teacher (вьюха, не фильтруется по дате — возвращает все)
  //    d) reflections_by_subject (вьюха)

  // 4. Вернуть JSON:
  // {
  //   period_days: 30,
  //   summary: { generated, saved, reflections, active_teachers },
  //   by_teacher: [...],    // из reflections_by_teacher
  //   by_subject: [...],    // из reflections_by_subject
  // }
}
```

### 3. React — AdminView компонент

```jsx
// App.jsx — добавить в начало:
const startInAdmin = window.location.pathname === '/admin';
const [showAdmin, setShowAdmin] = useState(startInAdmin);

// Если startInAdmin и user?.user_metadata?.role in ['admin','superadmin']:
// → рендерить <AdminView user={user} onClose={...} />

// Иначе если startInAdmin и нет нужной роли:
// → рендерить заглушку "Недостаточно прав"
```

Структура компонента:
```
AdminView
├── PeriodSelector (7д / 30д / 90д)
├── SummaryCards (4 карточки: сгенерировано, сохранено, рефлексий, учителей)
├── TeacherTable (сортируемая таблица учителей)
│   └── строки: user_id_short, lessons, reflections, avg_rating, last_active
├── SubjectTable (предмет / класс / уроков / avg_rating / mood)
│   └── подсветка красным если avg_rating < 3
└── (Should Have) ReflectionFeed — последние 20 рефлексий
```

### 4. Суперадмин — назначение роли

Роль устанавливается через Supabase Dashboard → Authentication → Users → Edit User Metadata:
```json
{ "role": "admin" }
```
или через SQL:
```sql
update auth.users
set raw_user_meta_data = raw_user_meta_data || '{"role":"admin"}'::jsonb
where email = 'zavuch@school.kz';
```

Для первого пилота суперадмин — Бабетов А. (alexey@babetov.kz, уже есть в системе).

### 5. Миграция `lesson_events`

Если таблица `lesson_events` ещё не существует в Supabase — создать миграцию:
```
supabase/migrations/20260304_create_lesson_events.sql
```

Проверить через Dashboard → Table Editor. Если `generate-lesson.js` уже пишет в неё — таблица есть, нужно только добавить индексы и RLS:
```sql
-- RLS: учитель видит только свои события
alter table public.lesson_events enable row level security;
create policy "teacher_own_events" on public.lesson_events
  for select using (auth.uid() = user_id);

-- admin видит всё
create policy "admin_read_all_events" on public.lesson_events
  for select using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('admin', 'superadmin')
  );
```

---

## Критерии приёмки

**Доступ:**
- [ ] Зайти на `/admin` как учитель (без роли admin) → видна заглушка «Недостаточно прав», не 500
- [ ] Зайти на `/admin` как завуч (role = 'admin') → дашборд открывается
- [ ] Зайти на `/admin` без авторизации → редирект на логин

**API:**
- [ ] `GET /api/dashboard?days=30` без токена → 403
- [ ] `GET /api/dashboard?days=30` с токеном учителя (не admin) → 403
- [ ] `GET /api/dashboard?days=30` с токеном admin → 200, JSON с полями `summary`, `by_teacher`, `by_subject`

**UI:**
- [ ] Карточки Summary отображают корректные цифры (сверить с Supabase Dashboard вручную)
- [ ] Таблица учителей отсортирована по last_active, строки не пустые
- [ ] Таблица предметов: строки с avg_rating < 3 подсвечены красным/оранжевым
- [ ] Переключатель 7д / 30д / 90д меняет данные (карточки пересчитываются)
- [ ] Проверить на мобильном (iOS Safari): таблицы горизонтально скроллятся
- [ ] `/admin?days=7` — URL работает при прямом заходе

---

## Метрики успеха

**Количественные:**
- Завуч ежедневно открывает дашборд ≥ 3 раза в неделю (через Supabase Analytics)
- 0 ошибок 403 для авторизованных adminов

**Качественные:**
- Завуч говорит «вижу, кто из учителей активен, кто нет» (вместо ручного опроса)
- Методист может назвать предмет с наихудшим avg_rating на основе дашборда

---

## Зависимости и риски

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| `lesson_events` ещё не существует в Supabase | Средняя | Проверить наличие таблицы; создать миграцию если нет |
| Медленный запрос к Supabase (много записей) | Низкая | Индексы на `created_at`, `user_id`; лимит 365 дней |
| RLS блокирует service role key | Очень низкая | Service role обходит RLS по умолчанию |
| Завуч хочет видеть email учителей | Вероятно | Для `superadmin` можно включить; обсудить с Бабетовым |

---

## Оценка трудозатрат

| Задача | Оценка |
|--------|--------|
| Проверить/создать `lesson_events` таблицу + RLS миграция | 30 мин |
| `api/dashboard.js` — JWT-проверка + 3 Supabase-запроса | 2 ч |
| `AdminView` — SummaryCards + TeacherTable + SubjectTable | 3 ч |
| Маршрут `/admin` + проверка роли в App.jsx | 30 мин |
| Тестирование + деплой | 1 ч |
| **Итого** | **~7 часов** |

---

## Порядок реализации

```
Sprint 4:
  1. Проверить lesson_events в Supabase (создать миграцию если нет)
  2. api/dashboard.js — backend-агрегация
  3. AdminView — SummaryCards + TeacherTable (минимальный UI)
  4. SubjectTable + подсветка проблемных предметов
  5. PeriodSelector (7д / 30д / 90д)
  6. Тест с реальными данными пилота

Sprint 4+ (Should Have):
  7. ReflectionFeed (лента последних рефлексий)
  8. Фильтр по предмету/классу
  9. Экспорт в CSV
```

---

## Открытые вопросы

1. **Email учителей в дашборде.** Показывать email или только UUID? Рекомендация: UUID в MVP, email только для суперадмина.
2. **Многошкольный режим.** Если к конструктору подключатся несколько школ — нужно добавить поле `school_id` в `reflections` и `lesson_events`. Отложить до Sprint 5.
3. **Период по умолчанию.** 30 дней — оптимально для пилота. Обсудить с завучем.
4. **Кнопка в шапке.** Добавить кнопку «Дашборд» в `Header` только для admin-пользователей?

---

*Документ создан: март 2026*
*Связанные документы: spec-lesson-library.md, spec-library-v2-courses.md*
*Связанные миграции: 20260302_create_reflections.sql, 20260304_create_lesson_events.sql*
