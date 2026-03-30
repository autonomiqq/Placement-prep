-- ─────────────────────────────────────────
--  ADMIN ROLE SYSTEM
-- ─────────────────────────────────────────

-- Add role column to profiles
alter table public.profiles
  add column if not exists role text not null default 'student'
  check (role in ('student', 'admin'));

create index if not exists profiles_role_idx on public.profiles (role);

-- ── Update handle_new_user trigger to set default role ─────────────────────
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username, full_name, avatar_url, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 4)
    ),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  -- Initialize category stats (only for students)
  if coalesce(new.raw_user_meta_data->>'role', 'student') = 'student' then
    insert into public.user_category_stats (user_id, category)
    select new.id, unnest(enum_range(null::test_category));
  end if;
  return new;
end;
$$;

-- ── RLS policies for admin access ─────────────────────────────────────────

-- Helper: is current user an admin?
create or replace function is_admin()
returns boolean language sql stable security definer as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Profiles: admins can read all
create policy "Admins read all profiles"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id or is_admin());

-- Profiles: admins can update any profile
create policy "Admins update profiles"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or is_admin());

-- Tests: admins can manage all tests
create policy "Admins manage all tests"
  on public.tests for all
  to authenticated
  using (is_admin())
  with check (is_admin());

-- Attempts: admins can read all attempts
create policy "Admins read all attempts"
  on public.test_attempts for select
  to authenticated
  using (auth.uid() = user_id or is_admin());

-- Category stats: admins can read all
create policy "Admins read all category stats"
  on public.user_category_stats for select
  to authenticated
  using (auth.uid() = user_id or is_admin());

-- ── Admin analytics function ───────────────────────────────────────────────
create or replace function get_admin_overview()
returns jsonb language plpgsql security definer as $$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'total_students',   (select count(*) from profiles where role = 'student'),
    'active_this_week', (select count(distinct user_id) from test_attempts
                         where started_at >= now() - interval '7 days'),
    'total_tests',      (select count(*) from tests),
    'published_tests',  (select count(*) from tests where is_published = true),
    'total_attempts',   (select count(*) from test_attempts where status = 'submitted'),
    'avg_score',        (select round(avg(percentage)::numeric, 1) from test_attempts where status = 'submitted')
  ) into result;
  return result;
end;
$$;

-- ── NOTE: First admin setup ────────────────────────────────────────────────
-- After registering your admin account, run this in Supabase SQL editor:
--   UPDATE public.profiles SET role = 'admin' WHERE id = '<your-user-uuid>';
-- Or use the /api/admin/setup endpoint (requires ADMIN_SETUP_SECRET env var).
