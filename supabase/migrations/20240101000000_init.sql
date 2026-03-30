-- ─────────────────────────────────────────
--  EXTENSIONS
-- ─────────────────────────────────────────
-- uuid-ossp not needed; using gen_random_uuid() (built-in since PG 13)
create extension if not exists "pg_trgm";

-- ─────────────────────────────────────────
--  ENUMS
-- ─────────────────────────────────────────
create type test_category as enum ('aptitude', 'verbal', 'technical', 'coding');
create type difficulty_level as enum ('easy', 'medium', 'hard');
create type question_type as enum ('mcq', 'coding');
create type attempt_status as enum ('in_progress', 'submitted', 'timed_out', 'abandoned');

-- ─────────────────────────────────────────
--  PROFILES  (extends auth.users 1:1)
-- ─────────────────────────────────────────
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null,
  full_name       text,
  college         text,
  branch          text,
  graduation_year smallint,
  avatar_url      text,
  total_points    integer not null default 0,
  rank            integer,
  streak_days     integer not null default 0,
  last_active     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────
--  TESTS
-- ─────────────────────────────────────────
create table tests (
  id              uuid primary key default gen_random_uuid(),
  title           text not null,
  description     text,
  category        test_category not null,
  difficulty      difficulty_level not null default 'medium',
  duration_mins   smallint not null,
  total_marks     integer not null,
  passing_marks   integer not null,
  is_ai_generated boolean not null default false,
  is_published    boolean not null default false,
  created_by      uuid references auth.users(id),
  tags            text[] default '{}',
  metadata        jsonb default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_tests_category on tests(category);
create index idx_tests_difficulty on tests(difficulty);
create index idx_tests_published on tests(is_published) where is_published = true;

-- ─────────────────────────────────────────
--  QUESTIONS
-- ─────────────────────────────────────────
create table questions (
  id              uuid primary key default gen_random_uuid(),
  test_id         uuid not null references tests(id) on delete cascade,
  question_number smallint not null,
  type            question_type not null,
  category        test_category not null,
  difficulty      difficulty_level not null,
  content         text not null,
  code_snippet    text,
  language        text,
  marks           integer not null default 1,
  negative_marks  numeric(3,1) default 0,
  time_limit_secs integer,
  explanation     text,
  ai_explanation  text,
  tags            text[] default '{}',
  created_at      timestamptz not null default now(),
  unique(test_id, question_number)
);

create index idx_questions_test on questions(test_id);
create index idx_questions_category on questions(category);

-- ─────────────────────────────────────────
--  MCQ OPTIONS
-- ─────────────────────────────────────────
create table mcq_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  option_key  char(1) not null check (option_key in ('A','B','C','D','E')),
  content     text not null,
  is_correct  boolean not null default false,
  unique(question_id, option_key)
);

-- ─────────────────────────────────────────
--  CODING TEST CASES
-- ─────────────────────────────────────────
create table test_cases (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  input       text not null,
  expected    text not null,
  is_hidden   boolean not null default false,
  weight      numeric(4,2) not null default 1.0
);

-- ─────────────────────────────────────────
--  TEST ATTEMPTS
-- ─────────────────────────────────────────
create table test_attempts (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  test_id         uuid not null references tests(id) on delete cascade,
  status          attempt_status not null default 'in_progress',
  score           integer,
  total_marks     integer,
  percentage      numeric(5,2),
  time_taken_secs integer,
  started_at      timestamptz not null default now(),
  submitted_at    timestamptz,
  metadata        jsonb default '{}'
);

create index idx_attempts_user on test_attempts(user_id);
create index idx_attempts_test on test_attempts(test_id);
create index idx_attempts_user_test on test_attempts(user_id, test_id);
create index idx_attempts_status on test_attempts(status);

-- ─────────────────────────────────────────
--  ANSWERS
-- ─────────────────────────────────────────
create table answers (
  id              uuid primary key default gen_random_uuid(),
  attempt_id      uuid not null references test_attempts(id) on delete cascade,
  question_id     uuid not null references questions(id) on delete cascade,
  selected_option char(1),
  code_solution   text,
  is_correct      boolean,
  marks_awarded   numeric(5,2),
  time_spent_secs integer,
  is_skipped      boolean not null default false,
  submitted_at    timestamptz default now(),
  unique(attempt_id, question_id)
);

create index idx_answers_attempt on answers(attempt_id);

-- ─────────────────────────────────────────
--  USER CATEGORY STATS
-- ─────────────────────────────────────────
create table user_category_stats (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  category        test_category not null,
  tests_taken     integer not null default 0,
  questions_seen  integer not null default 0,
  correct_count   integer not null default 0,
  avg_score       numeric(5,2) not null default 0,
  best_score      numeric(5,2) not null default 0,
  total_time_secs bigint not null default 0,
  updated_at      timestamptz not null default now(),
  unique(user_id, category)
);

-- ─────────────────────────────────────────
--  AI TUTOR SESSIONS & MESSAGES
-- ─────────────────────────────────────────
create table tutor_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text,
  context     jsonb default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table tutor_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references tutor_sessions(id) on delete cascade,
  role        text not null check (role in ('user', 'assistant', 'system')),
  content     text not null,
  tokens_used integer,
  created_at  timestamptz not null default now()
);

create index idx_tutor_messages_session on tutor_messages(session_id);

-- ─────────────────────────────────────────
--  LEADERBOARD VIEW
-- ─────────────────────────────────────────
create or replace view leaderboard as
select
  p.id,
  p.username,
  p.full_name,
  p.avatar_url,
  p.college,
  p.branch,
  p.total_points,
  p.streak_days,
  rank() over (order by p.total_points desc) as rank
from profiles p
where p.total_points > 0;
