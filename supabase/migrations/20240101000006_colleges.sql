-- ─────────────────────────────────────────
--  COLLEGES
-- ─────────────────────────────────────────
create table colleges (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text not null,
  created_at timestamptz not null default now(),
  unique(name),
  unique(code)
);

-- ─────────────────────────────────────────
--  ADD SECTION TO PROFILES
-- ─────────────────────────────────────────
alter table public.profiles
  add column if not exists section text;      -- e.g. 'A', 'B', 'C'

-- ─────────────────────────────────────────
--  TEST ASSIGNMENTS
--  A test with NO rows here is visible to ALL students.
--  A test with rows is only visible to students matching
--  at least one row (null field = wildcard).
-- ─────────────────────────────────────────
create table test_assignments (
  id         uuid primary key default gen_random_uuid(),
  test_id    uuid not null references tests(id) on delete cascade,
  college    text,   -- null = any college
  branch     text,   -- null = any branch
  section    text,   -- null = any section
  created_at timestamptz not null default now(),
  unique(test_id, college, branch, section)
);

create index idx_test_assignments_test on test_assignments(test_id);

-- ─────────────────────────────────────────
--  RLS
-- ─────────────────────────────────────────
alter table colleges enable row level security;
alter table test_assignments enable row level security;

-- Colleges: admins manage, authenticated users read
create policy "colleges_read" on colleges
  for select using (auth.role() = 'authenticated');

create policy "colleges_admin_write" on colleges
  for all using (is_admin()) with check (is_admin());

-- Test assignments: admins manage, authenticated users read
create policy "test_assignments_read" on test_assignments
  for select using (auth.role() = 'authenticated');

create policy "test_assignments_admin_write" on test_assignments
  for all using (is_admin()) with check (is_admin());

-- ─────────────────────────────────────────
--  HELPER: get_visible_test_ids(uid)
--  Returns test ids visible to a specific student.
-- ─────────────────────────────────────────
create or replace function get_visible_test_ids(p_user_id uuid)
returns setof uuid language sql stable security definer as $$
  select t.id
  from tests t
  where t.is_published = true
    and (
      -- No assignment rows = visible to everyone
      not exists (select 1 from test_assignments ta where ta.test_id = t.id)
      or
      -- Has at least one matching assignment (null fields = wildcard)
      exists (
        select 1
        from test_assignments ta
        join profiles p on p.id = p_user_id
        where ta.test_id = t.id
          and (ta.college is null or ta.college = p.college)
          and (ta.branch  is null or ta.branch  = p.branch)
          and (ta.section is null or ta.section = p.section)
      )
    );
$$;
