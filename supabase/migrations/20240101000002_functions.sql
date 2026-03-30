-- ─────────────────────────────────────────
--  AUTO-CREATE PROFILE ON SIGNUP
-- ─────────────────────────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4)
    ),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  -- Initialize all 4 category stats rows
  insert into public.user_category_stats (user_id, category)
  select new.id, unnest(enum_range(null::test_category));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─────────────────────────────────────────
--  SCORE ATTEMPT
-- ─────────────────────────────────────────
create or replace function score_attempt(p_attempt_id uuid)
returns jsonb language plpgsql security definer as $$
declare
  v_score       numeric := 0;
  v_total       integer;
  v_time_taken  integer;
  v_user_id     uuid;
  v_test_id     uuid;
  v_category    test_category;
  v_result      jsonb;
begin
  -- Get attempt info
  select user_id, test_id into v_user_id, v_test_id
  from test_attempts where id = p_attempt_id;

  if not found then
    raise exception 'Attempt not found: %', p_attempt_id;
  end if;

  -- Get test category and total marks
  select category, total_marks into v_category, v_total
  from tests where id = v_test_id;

  -- Mark correct MCQ answers and compute marks
  update answers a
  set
    is_correct = (
      select o.is_correct from mcq_options o
      where o.question_id = a.question_id
        and o.option_key = a.selected_option
    ),
    marks_awarded = case
      when a.selected_option is null or a.is_skipped then 0
      when (select o.is_correct from mcq_options o
            where o.question_id = a.question_id
              and o.option_key = a.selected_option)
      then (select q.marks from questions q where q.id = a.question_id)
      else -(select q.negative_marks from questions q where q.id = a.question_id)
    end
  where a.attempt_id = p_attempt_id
    and exists (select 1 from questions q where q.id = a.question_id and q.type = 'mcq');

  -- Compute total score
  select
    coalesce(sum(marks_awarded), 0),
    extract(epoch from (now() - started_at))::integer
  into v_score, v_time_taken
  from answers a
  join test_attempts ta on ta.id = a.attempt_id
  where a.attempt_id = p_attempt_id;

  -- Update attempt record
  update test_attempts
  set
    status = 'submitted',
    score = greatest(0, v_score::integer),
    total_marks = v_total,
    percentage = round((greatest(0, v_score) / v_total::numeric) * 100, 2),
    time_taken_secs = v_time_taken,
    submitted_at = now()
  where id = p_attempt_id;

  -- Upsert category stats
  insert into user_category_stats (user_id, category, tests_taken, questions_seen,
    correct_count, avg_score, best_score, total_time_secs)
  select
    v_user_id,
    v_category,
    1,
    count(a.id),
    count(a.id) filter (where a.is_correct = true),
    round((greatest(0, v_score) / v_total::numeric) * 100, 2),
    round((greatest(0, v_score) / v_total::numeric) * 100, 2),
    v_time_taken
  from answers a
  where a.attempt_id = p_attempt_id
  on conflict (user_id, category) do update set
    tests_taken    = user_category_stats.tests_taken + 1,
    questions_seen = user_category_stats.questions_seen + excluded.questions_seen,
    correct_count  = user_category_stats.correct_count + excluded.correct_count,
    avg_score      = round(
      (user_category_stats.avg_score * user_category_stats.tests_taken + excluded.avg_score)
      / (user_category_stats.tests_taken + 1), 2
    ),
    best_score     = greatest(user_category_stats.best_score, excluded.best_score),
    total_time_secs = user_category_stats.total_time_secs + excluded.total_time_secs,
    updated_at     = now();

  -- Update profile points
  update profiles
  set
    total_points = total_points + greatest(0, v_score::integer),
    last_active  = now()
  where id = v_user_id;

  select to_jsonb(ta) into v_result
  from test_attempts ta where ta.id = p_attempt_id;

  return v_result;
end;
$$;

-- ─────────────────────────────────────────
--  UPDATE LEADERBOARD RANKS (periodic)
-- ─────────────────────────────────────────
create or replace function refresh_ranks()
returns void language plpgsql security definer as $$
begin
  with ranked as (
    select id, rank() over (order by total_points desc) as new_rank
    from profiles
  )
  update profiles p
  set rank = r.new_rank
  from ranked r
  where p.id = r.id;
end;
$$;
