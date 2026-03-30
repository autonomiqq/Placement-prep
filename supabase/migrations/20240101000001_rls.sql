-- Enable RLS on all tables
alter table profiles             enable row level security;
alter table tests                enable row level security;
alter table questions            enable row level security;
alter table mcq_options          enable row level security;
alter table test_cases           enable row level security;
alter table test_attempts        enable row level security;
alter table answers              enable row level security;
alter table user_category_stats  enable row level security;
alter table tutor_sessions       enable row level security;
alter table tutor_messages       enable row level security;

-- ── PROFILES ────────────────────────────────────────────────────────────────
create policy "profiles_select" on profiles
  for select using (auth.role() = 'authenticated');

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);

-- ── TESTS ───────────────────────────────────────────────────────────────────
create policy "tests_select_published" on tests
  for select using (auth.role() = 'authenticated' and is_published = true);

-- ── QUESTIONS ───────────────────────────────────────────────────────────────
create policy "questions_select" on questions
  for select using (
    exists (
      select 1 from tests t
      where t.id = questions.test_id
        and t.is_published = true
        and auth.role() = 'authenticated'
    )
  );

-- ── MCQ OPTIONS ─────────────────────────────────────────────────────────────
-- is_correct field is filtered at the application layer during active attempts
create policy "mcq_options_select" on mcq_options
  for select using (
    exists (
      select 1 from questions q
      join tests t on t.id = q.test_id
      where q.id = mcq_options.question_id
        and t.is_published = true
        and auth.role() = 'authenticated'
    )
  );

-- ── TEST CASES ──────────────────────────────────────────────────────────────
-- Hidden from all students; accessed via service role key only
create policy "test_cases_deny_students" on test_cases
  for select using (false);

-- ── TEST ATTEMPTS ────────────────────────────────────────────────────────────
create policy "attempts_select_own" on test_attempts
  for select using (auth.uid() = user_id);

create policy "attempts_insert_own" on test_attempts
  for insert with check (auth.uid() = user_id);

create policy "attempts_update_own_inprogress" on test_attempts
  for update using (auth.uid() = user_id and status = 'in_progress');

-- ── ANSWERS ─────────────────────────────────────────────────────────────────
create policy "answers_select_own" on answers
  for select using (
    exists (
      select 1 from test_attempts a
      where a.id = answers.attempt_id and a.user_id = auth.uid()
    )
  );

create policy "answers_insert_own" on answers
  for insert with check (
    exists (
      select 1 from test_attempts a
      where a.id = answers.attempt_id
        and a.user_id = auth.uid()
        and a.status = 'in_progress'
    )
  );

create policy "answers_update_own" on answers
  for update using (
    exists (
      select 1 from test_attempts a
      where a.id = answers.attempt_id
        and a.user_id = auth.uid()
        and a.status = 'in_progress'
    )
  );

-- ── CATEGORY STATS ───────────────────────────────────────────────────────────
create policy "stats_all_own" on user_category_stats
  for all using (auth.uid() = user_id);

-- ── TUTOR SESSIONS & MESSAGES ────────────────────────────────────────────────
create policy "tutor_sessions_all_own" on tutor_sessions
  for all using (auth.uid() = user_id);

create policy "tutor_messages_all_own" on tutor_messages
  for all using (
    exists (
      select 1 from tutor_sessions s
      where s.id = tutor_messages.session_id and s.user_id = auth.uid()
    )
  );
