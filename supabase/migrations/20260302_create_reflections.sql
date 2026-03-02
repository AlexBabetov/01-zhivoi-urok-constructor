-- Миграция: таблица рефлексий учителей после урока
-- Выполнить в: Supabase Dashboard → SQL Editor
-- Проект: wogcofceyeeouxokzpqy (корифей)
-- Дата: 2026-03-02

-- ============================================================
-- Таблица reflections
-- ============================================================
create table if not exists public.reflections (
  id            text primary key,          -- makeReflId: subject-grade-topic (уникален для учитель+урок)
  user_id       uuid not null references auth.users(id) on delete cascade,
  subject       text not null,
  grade         smallint not null,
  topic         text not null,
  rating        smallint check (rating between 1 and 5),
  timing        text check (timing in ('ok', '5min', 'long')),
  mood          text check (mood in ('low', 'work', 'active', 'fire')),
  wellbeing     text check (wellbeing in ('tired', 'ok', 'good', 'excited', 'mixed')),
  capture_used  text check (capture_used in ('0', '1', '2', '3')),
  notes         text,
  saved_at      timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Индексы для дашборда завуча (Sprint 4)
create index if not exists reflections_user_id_idx    on public.reflections(user_id);
create index if not exists reflections_subject_idx    on public.reflections(subject);
create index if not exists reflections_grade_idx      on public.reflections(grade);
create index if not exists reflections_saved_at_idx   on public.reflections(saved_at desc);

-- Автоматическое обновление updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reflections_updated_at on public.reflections;
create trigger reflections_updated_at
  before update on public.reflections
  for each row execute function public.touch_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.reflections enable row level security;

-- Учитель видит и редактирует только свои рефлексии
create policy "teacher_own_reflections" on public.reflections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Завуч/admin видит все рефлексии своей школы
-- (уточнить когда добавим школу в user_metadata; пока admin видит всё)
create policy "admin_read_all_reflections" on public.reflections
  for select
  using (
    (auth.jwt() -> 'user_metadata' ->> 'role') in ('admin', 'superadmin')
  );

-- ============================================================
-- Аналитические вьюхи для дашборда завуча (Sprint 4)
-- ============================================================

-- Средние показатели по учителю
create or replace view public.reflections_by_teacher as
select
  user_id,
  count(*)::int                                      as total_lessons,
  round(avg(rating), 1)                              as avg_rating,
  count(*) filter (where timing = 'ok')::int         as timing_ok_count,
  count(*) filter (where mood = 'fire')::int         as high_energy_count,
  count(*) filter (where mood = 'low')::int          as low_energy_count,
  max(saved_at)                                      as last_reflection_at
from public.reflections
group by user_id;

-- Средние показатели по предмету
create or replace view public.reflections_by_subject as
select
  subject,
  grade,
  count(*)::int           as total,
  round(avg(rating), 1)   as avg_rating,
  mode() within group (order by mood)       as typical_mood,
  mode() within group (order by wellbeing)  as typical_wellbeing
from public.reflections
group by subject, grade;

comment on table public.reflections is
  'Рефлексии учителей после проведённых уроков. Двойное хранение: localStorage (offline) + Supabase (облако, для дашборда завуча).';
