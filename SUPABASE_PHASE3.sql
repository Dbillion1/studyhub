-- ════════════════════════════════════════════════════════════
--  StudyHub - Phase 3 database schema and security (RLS)
--  Run this in Supabase Dashboard -> SQL Editor.
--
--  This file is additive and idempotent. It is safe to run whether
--  or not you already ran SUPABASE_SCHEMA.sql, and safe to run more
--  than once. It supersedes the original schema file.
--
--  Security model in one line: the service-role key (used only by
--  Netlify Functions) bypasses RLS; the browser uses the anon key as
--  the "authenticated" role and is constrained by the policies below.
-- ════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;

-- ────────────────────────────────────────────────────────────
-- generic helper: keep updated_at fresh on UPDATE
-- ────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ════════════════════════════════════════════════════════════
-- 1. PROFILES  (account + plan; one row per auth user)
--    Kept compatible with the existing Stripe/auth functions.
-- ════════════════════════════════════════════════════════════
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  plan text not null default 'free' check (plan in ('free', 'pro', 'ultimate')),
  subscription_status text not null default 'free',
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_stripe_customer_idx on public.profiles(stripe_customer_id);
create index if not exists profiles_stripe_subscription_idx on public.profiles(stripe_subscription_id);

alter table public.profiles enable row level security;

-- A user can read their own profile.
do $$ begin
  create policy "profiles_select_own" on public.profiles
    for select to authenticated using (auth.uid() = id);
exception when duplicate_object then null; end $$;

-- A user can update their own profile row. Payment columns are frozen
-- by the trigger below, so this only lets them edit name + learning profile.
do $$ begin
  create policy "profiles_update_own" on public.profiles
    for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
exception when duplicate_object then null; end $$;

-- SECURITY: stop browser (anon/authenticated) requests from changing
-- payment, identity or status columns. Only the service-role key
-- (Netlify Functions, e.g. the Stripe webhook) may change those.
create or replace function public.protect_profile_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    new.id := old.id;
    new.email := old.email;
    new.plan := old.plan;
    new.subscription_status := old.subscription_status;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.current_period_end := old.current_period_end;
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists protect_profile_columns_trg on public.profiles;
create trigger protect_profile_columns_trg
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ════════════════════════════════════════════════════════════
-- 2. USER ROLES / TAGS  (privileged role lives here, NOT in profiles)
--    Normal users can never write to this table, so they can never
--    promote themselves. Roles are set by the owner or by functions.
-- ════════════════════════════════════════════════════════════
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'student'
    check (role in ('student', 'parent', 'owner', 'developer', 'moderator')),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_roles enable row level security;

-- ────────────────────────────────────────────────────────────
-- role helper functions (SECURITY DEFINER so they bypass RLS when
-- reading user_roles, which also prevents policy recursion).
-- ────────────────────────────────────────────────────────────
create or replace function public.app_role(uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.user_roles where user_id = uid), 'student');
$$;

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_role(auth.uid()) = 'owner';
$$;

-- "staff" = can moderate (owner or moderator)
create or replace function public.is_moderator()
returns boolean language sql stable security definer set search_path = public as $$
  select public.app_role(auth.uid()) in ('owner', 'moderator');
$$;

-- A user can read their own role. The owner can read all roles (admin).
do $$ begin
  create policy "user_roles_select" on public.user_roles
    for select to authenticated using (user_id = auth.uid() or public.is_owner());
exception when duplicate_object then null; end $$;

-- Only the owner may create/change/remove roles from the browser.
-- (Functions use the service-role key and bypass this.)
do $$ begin
  create policy "user_roles_insert_owner" on public.user_roles
    for insert to authenticated with check (public.is_owner());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "user_roles_update_owner" on public.user_roles
    for update to authenticated using (public.is_owner()) with check (public.is_owner());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "user_roles_delete_owner" on public.user_roles
    for delete to authenticated using (public.is_owner());
exception when duplicate_object then null; end $$;

drop trigger if exists user_roles_updated_at on public.user_roles;
create trigger user_roles_updated_at before update on public.user_roles
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════
-- 3. PARENT - CHILD LINKS  (protected; parent requests, child approves)
-- ════════════════════════════════════════════════════════════
create table if not exists public.parent_child_links (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid not null references auth.users(id) on delete cascade,
  child_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parent_id, child_id),
  check (parent_id <> child_id)
);
create index if not exists pcl_parent_idx on public.parent_child_links(parent_id);
create index if not exists pcl_child_idx on public.parent_child_links(child_id);

alter table public.parent_child_links enable row level security;

-- helper: is the caller an APPROVED parent of this child?
create or replace function public.is_approved_parent_of(child uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_child_links l
    where l.parent_id = auth.uid() and l.child_id = child and l.status = 'approved'
  );
$$;

-- Only the two people in a link (or the owner) can see it.
do $$ begin
  create policy "pcl_select" on public.parent_child_links
    for select to authenticated
    using (parent_id = auth.uid() or child_id = auth.uid() or public.is_owner());
exception when duplicate_object then null; end $$;

-- A parent creates a pending request for themselves.
do $$ begin
  create policy "pcl_insert" on public.parent_child_links
    for insert to authenticated
    with check (parent_id = auth.uid() and status = 'pending' and parent_id <> child_id);
exception when duplicate_object then null; end $$;

-- Either party (or owner) can update status (the child approves; either revokes).
do $$ begin
  create policy "pcl_update" on public.parent_child_links
    for update to authenticated
    using (child_id = auth.uid() or parent_id = auth.uid() or public.is_owner())
    with check (child_id = auth.uid() or parent_id = auth.uid() or public.is_owner());
exception when duplicate_object then null; end $$;

-- Either party (or owner) can remove the link.
do $$ begin
  create policy "pcl_delete" on public.parent_child_links
    for delete to authenticated
    using (parent_id = auth.uid() or child_id = auth.uid() or public.is_owner());
exception when duplicate_object then null; end $$;

drop trigger if exists pcl_updated_at on public.parent_child_links;
create trigger pcl_updated_at before update on public.parent_child_links
  for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════
-- 4. Extra PROFILES read policies for owner + approved parents
--    (added after the helpers exist). These are additive: they only
--    widen SELECT for staff/parents, never for ordinary users.
-- ════════════════════════════════════════════════════════════
do $$ begin
  create policy "profiles_select_owner" on public.profiles
    for select to authenticated using (public.is_owner());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "profiles_select_parent" on public.profiles
    for select to authenticated using (public.is_approved_parent_of(id));
exception when duplicate_object then null; end $$;

-- ════════════════════════════════════════════════════════════
-- 5. AUTO-PROVISION on signup: create profile + student role.
--    Runs as definer, so it is not blocked by RLS.
-- ════════════════════════════════════════════════════════════
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Never let provisioning block a signup: swallow and log any error.
  begin
    insert into public.profiles (id, email, full_name)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
    on conflict (id) do nothing;

    insert into public.user_roles (user_id, role)
    values (new.id, 'student')
    on conflict (user_id) do nothing;
  exception when others then
    raise warning 'handle_new_user provisioning failed for %: %', new.id, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill any existing auth users (safe to re-run).
insert into public.profiles (id, email, full_name)
  select id, email, coalesce(raw_user_meta_data->>'full_name', split_part(email, '@', 1))
  from auth.users
  on conflict (id) do nothing;

insert into public.user_roles (user_id, role)
  select id, 'student' from auth.users
  on conflict (user_id) do nothing;

-- ════════════════════════════════════════════════════════════
-- 6. PLANS catalog  (reference data; the user's ACTIVE plan stays in
--    profiles, driven by the Stripe webhook). Public-readable.
-- ════════════════════════════════════════════════════════════
create table if not exists public.plans (
  id text primary key check (id in ('free', 'pro', 'ultimate')),
  name text not null,
  monthly_ai_messages int,
  features jsonb not null default '{}'::jsonb,
  sort_order int not null default 0
);
alter table public.plans enable row level security;

do $$ begin
  create policy "plans_select_all" on public.plans
    for select to anon, authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "plans_write_owner" on public.plans
    for all to authenticated using (public.is_owner()) with check (public.is_owner());
exception when duplicate_object then null; end $$;

insert into public.plans (id, name, monthly_ai_messages, sort_order, features) values
  ('free', 'Free', 10, 0, '{"note":"General GCSE revision tools"}'::jsonb),
  ('pro', 'Pro', NULL, 1, '{"note":"Higher AI limits, note upload"}'::jsonb),
  ('ultimate', 'Ultimate', NULL, 2, '{"note":"Best model, parent reports"}'::jsonb)
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════
-- 7. POSTS + COMMENTS + LIKES  (community; readable by all signed-in
--    users. Authors manage their own; moderators/owner can delete.)
-- ════════════════════════════════════════════════════════════
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  category text,
  body text not null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists posts_user_idx on public.posts(user_id);
create index if not exists posts_created_idx on public.posts(created_at desc);
alter table public.posts enable row level security;

do $$ begin
  create policy "posts_select_all" on public.posts
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "posts_insert_own" on public.posts
    for insert to authenticated with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "posts_update_own_or_owner" on public.posts
    for update to authenticated
    using (user_id = auth.uid() or public.is_owner())
    with check (user_id = auth.uid() or public.is_owner());
exception when duplicate_object then null; end $$;
-- authors delete their own; moderators and owner can delete any post
do $$ begin
  create policy "posts_delete_own_or_staff" on public.posts
    for delete to authenticated
    using (user_id = auth.uid() or public.is_moderator());
exception when duplicate_object then null; end $$;

drop trigger if exists posts_updated_at on public.posts;
create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

create table if not exists public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  author_name text,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.post_comments(post_id);
alter table public.post_comments enable row level security;

do $$ begin
  create policy "comments_select_all" on public.post_comments
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "comments_insert_own" on public.post_comments
    for insert to authenticated with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "comments_update_own" on public.post_comments
    for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "comments_delete_own_or_staff" on public.post_comments
    for delete to authenticated using (user_id = auth.uid() or public.is_moderator());
exception when duplicate_object then null; end $$;

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_likes enable row level security;

do $$ begin
  create policy "likes_select_all" on public.post_likes
    for select to authenticated using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "likes_insert_own" on public.post_likes
    for insert to authenticated with check (user_id = auth.uid());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "likes_delete_own" on public.post_likes
    for delete to authenticated using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- ════════════════════════════════════════════════════════════
-- 8. NOTES, UPLOADED NOTES, FLASHCARDS, QUIZ ATTEMPTS
--    All private study content: owner can administer; otherwise
--    a user only sees and edits their own rows.
-- ════════════════════════════════════════════════════════════
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  title text,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_user_idx on public.notes(user_id);
alter table public.notes enable row level security;

create table if not exists public.uploaded_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text,
  storage_path text,          -- path in a Supabase Storage bucket (set up in Phase 7)
  extracted_text text,        -- text read from the note (if a vision model is configured)
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists uploaded_notes_user_idx on public.uploaded_notes(user_id);
alter table public.uploaded_notes enable row level security;

create table if not exists public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  front text not null,
  back text not null,
  confidence int not null default 0,            -- spaced repetition (Phase 7)
  last_reviewed timestamptz,
  next_review timestamptz,
  correct_count int not null default 0,
  incorrect_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists flashcards_user_idx on public.flashcards(user_id);
create index if not exists flashcards_due_idx on public.flashcards(user_id, next_review);
alter table public.flashcards enable row level security;

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text,
  topic text,
  score int,
  total int,
  percent numeric,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists quiz_attempts_user_idx on public.quiz_attempts(user_id);
alter table public.quiz_attempts enable row level security;

-- Owner-or-self policies, applied to each private table by name.
do $$
declare t text;
begin
  foreach t in array array['notes','uploaded_notes','flashcards','quiz_attempts'] loop
    execute format($f$
      do $i$ begin
        create policy "%1$s_select" on public.%1$s
          for select to authenticated using (user_id = auth.uid() or public.is_owner());
      exception when duplicate_object then null; end $i$;
    $f$, t);
    execute format($f$
      do $i$ begin
        create policy "%1$s_insert" on public.%1$s
          for insert to authenticated with check (user_id = auth.uid());
      exception when duplicate_object then null; end $i$;
    $f$, t);
    execute format($f$
      do $i$ begin
        create policy "%1$s_update" on public.%1$s
          for update to authenticated
          using (user_id = auth.uid() or public.is_owner())
          with check (user_id = auth.uid() or public.is_owner());
      exception when duplicate_object then null; end $i$;
    $f$, t);
    execute format($f$
      do $i$ begin
        create policy "%1$s_delete" on public.%1$s
          for delete to authenticated using (user_id = auth.uid() or public.is_owner());
      exception when duplicate_object then null; end $i$;
    $f$, t);
  end loop;
end $$;

drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at before update on public.notes for each row execute function public.set_updated_at();
drop trigger if exists uploaded_notes_updated_at on public.uploaded_notes;
create trigger uploaded_notes_updated_at before update on public.uploaded_notes for each row execute function public.set_updated_at();
drop trigger if exists flashcards_updated_at on public.flashcards;
create trigger flashcards_updated_at before update on public.flashcards for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════
-- 9. PLANNER: onboarding, tasks, and task completion evidence
-- ════════════════════════════════════════════════════════════
create table if not exists public.planner_onboarding (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,   -- subjects, target grades, exam dates, time, style, fixed commitments
  updated_at timestamptz not null default now()
);
alter table public.planner_onboarding enable row level security;

create table if not exists public.planner_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date,
  title text not null,
  subject text,
  due_date date,
  task_type text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  evidence_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists planner_tasks_user_idx on public.planner_tasks(user_id);
create index if not exists planner_tasks_week_idx on public.planner_tasks(user_id, week_start);
alter table public.planner_tasks enable row level security;

create table if not exists public.task_evidence (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.planner_tasks(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('quiz_score','flashcards','note','written','ai_marked','self','parent_confirm','moderator_confirm')),
  detail jsonb not null default '{}'::jsonb,
  confirmed boolean not null default false,
  confirmed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists task_evidence_task_idx on public.task_evidence(task_id);
create index if not exists task_evidence_user_idx on public.task_evidence(user_id);
alter table public.task_evidence enable row level security;

do $$
declare t text;
begin
  foreach t in array array['planner_onboarding','planner_tasks','task_evidence'] loop
    execute format($f$
      do $i$ begin
        create policy "%1$s_select" on public.%1$s
          for select to authenticated using (user_id = auth.uid() or public.is_owner());
      exception when duplicate_object then null; end $i$;
    $f$, t);
    execute format($f$
      do $i$ begin
        create policy "%1$s_insert" on public.%1$s
          for insert to authenticated with check (user_id = auth.uid());
      exception when duplicate_object then null; end $i$;
    $f$, t);
    execute format($f$
      do $i$ begin
        create policy "%1$s_update" on public.%1$s
          for update to authenticated
          using (user_id = auth.uid() or public.is_owner())
          with check (user_id = auth.uid() or public.is_owner());
      exception when duplicate_object then null; end $i$;
    $f$, t);
    execute format($f$
      do $i$ begin
        create policy "%1$s_delete" on public.%1$s
          for delete to authenticated using (user_id = auth.uid() or public.is_owner());
      exception when duplicate_object then null; end $i$;
    $f$, t);
  end loop;
end $$;

drop trigger if exists planner_onboarding_updated_at on public.planner_onboarding;
create trigger planner_onboarding_updated_at before update on public.planner_onboarding for each row execute function public.set_updated_at();
drop trigger if exists planner_tasks_updated_at on public.planner_tasks;
create trigger planner_tasks_updated_at before update on public.planner_tasks for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════
-- 10. WEEKLY REPORTS  (student-owned; readable by owner and by an
--     APPROVED parent only)
-- ════════════════════════════════════════════════════════════
create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  data jsonb not null default '{}'::jsonb,    -- study_time, completed/missed tasks, quiz_scores, weak_topics, flashcard_accuracy, ai_usage
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);
create index if not exists weekly_reports_user_idx on public.weekly_reports(user_id);
alter table public.weekly_reports enable row level security;

do $$ begin
  create policy "weekly_reports_select" on public.weekly_reports
    for select to authenticated
    using (user_id = auth.uid() or public.is_owner() or public.is_approved_parent_of(user_id));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "weekly_reports_insert" on public.weekly_reports
    for insert to authenticated with check (user_id = auth.uid() or public.is_owner());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "weekly_reports_update" on public.weekly_reports
    for update to authenticated
    using (user_id = auth.uid() or public.is_owner())
    with check (user_id = auth.uid() or public.is_owner());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "weekly_reports_delete" on public.weekly_reports
    for delete to authenticated using (user_id = auth.uid() or public.is_owner());
exception when duplicate_object then null; end $$;

drop trigger if exists weekly_reports_updated_at on public.weekly_reports;
create trigger weekly_reports_updated_at before update on public.weekly_reports for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════
-- 11. AI USAGE TRACKING  (one row per user per day; written by the
--     AI function with the service-role key in Phase 5). Users can
--     read their own usage; only the owner can write from the browser.
-- ════════════════════════════════════════════════════════════
create table if not exists public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null default (now() at time zone 'utc')::date,
  plan text not null default 'free',
  gpt_count int not null default 0,
  gemini_count int not null default 0,
  tokens_est int not null default 0,
  blocked boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, usage_date)
);
create index if not exists ai_usage_user_idx on public.ai_usage(user_id, usage_date);
alter table public.ai_usage enable row level security;

do $$ begin
  create policy "ai_usage_select" on public.ai_usage
    for select to authenticated using (user_id = auth.uid() or public.is_owner());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "ai_usage_write_owner" on public.ai_usage
    for all to authenticated using (public.is_owner()) with check (public.is_owner());
exception when duplicate_object then null; end $$;

drop trigger if exists ai_usage_updated_at on public.ai_usage;
create trigger ai_usage_updated_at before update on public.ai_usage for each row execute function public.set_updated_at();

-- ════════════════════════════════════════════════════════════
-- 12. GRANTS
--     RLS is the gate, but the API roles still need table privileges.
--     Supabase usually grants these by default; we set them explicitly
--     so the schema is self-contained.
-- ════════════════════════════════════════════════════════════
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.plans to anon;
grant execute on all functions in schema public to anon, authenticated;

-- Done.
