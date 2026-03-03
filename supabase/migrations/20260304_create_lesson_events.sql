-- Миграция: таблица событий генерации и сохранения уроков
-- Выполнить в: Supabase Dashboard → SQL Editor
-- Проект: wogcofceyeeouxokzpqy (корифей)
-- Дата: 2026-03-04
-- Важно: запустить ПЕРЕД использованием api/get-analytics.js

-- ============================================================
-- Таблица lesson_events
-- Пишется из: api/generate-lesson.js (event_type='generated')
--             api/save-lesson.js     (event_type='saved')
-- ============================================================
create table if not exists public.lesson_events (
  id           bigserial primary key,
  user_id      uuid references auth.users(id) on delete set null,
  user_email   text,
  event_type   text not null check (event_type in ('generated', 'saved')),
  subject      text,
  grade        smallint,
  lesson_title text,
  lesson_id    text,                              -- filename в GitHub (только для 'saved')
  created_at   timestamptz not null default now()
);

-- Индексы для быстрых агрегаций (дашборд завуча)
create index if not exists lesson_events_user_id_idx    on public.lesson_events(user_id);
create index if not exists lesson_events_created_at_idx on public.lesson_events(created_at desc);
create index if not exists lesson_events_event_type_idx on public.lesson_events(event_type);
create index if not exists lesson_events_subject_idx    on public.lesson_events(subject);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.lesson_events enable row level security;

-- Учитель видит только свои события (для личного кабинета в будущем)
create policy "teacher_own_events" on public.lesson_events
  for select
  using (auth.uid() = user_id);

-- Admin/superadmin видит все события (для дашборда)
create policy "admin_read_all_events" on public.lesson_events
  for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('admin', 'superadmin')
  );

-- Только service role может писать (Edge Functions используют service key)
-- insert через anon key заблокирован (политики insert не создаём)

comment on table public.lesson_events is
  'События конструктора уроков: generated (запрос к AI) и saved (сохранение в GitHub). '
  'Используется дашбордом завуча для аналитики активности учителей.';

comment on column public.lesson_events.event_type is
  'generated — учитель запросил генерацию урока; saved — урок сохранён в библиотеку';
comment on column public.lesson_events.lesson_id is
  'Имя файла в GitHub репозитории (заполняется только для event_type = saved)';
