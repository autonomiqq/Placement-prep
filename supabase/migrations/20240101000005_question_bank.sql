-- ─────────────────────────────────────────
--  QUESTION BANK
--  Pre-generated questions stored independently of any test.
--  Admin bulk-generates here; test creation pulls from this pool.
-- ─────────────────────────────────────────

create table question_bank (
  id          uuid primary key default gen_random_uuid(),
  type        question_type not null default 'mcq',
  category    test_category not null,
  difficulty  difficulty_level not null,
  topic       text not null,
  content     text not null,
  explanation text,
  tags        text[] default '{}',
  used_count  integer not null default 0,
  created_at  timestamptz not null default now()
);

create index idx_qbank_category   on question_bank(category);
create index idx_qbank_difficulty on question_bank(difficulty);
create index idx_qbank_cat_diff   on question_bank(category, difficulty);

create table question_bank_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references question_bank(id) on delete cascade,
  option_key  char(1) not null check (option_key in ('A','B','C','D')),
  content     text not null,
  is_correct  boolean not null default false,
  unique(question_id, option_key)
);

create index idx_qbank_options_qid on question_bank_options(question_id);

-- Helper called by pull API to track which questions have been used
create or replace function increment_bank_used_count(ids uuid[])
returns void language sql security definer as $$
  update question_bank
  set used_count = used_count + 1
  where id = any(ids);
$$;
