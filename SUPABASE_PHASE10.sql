-- ════════════════════════════════════════════════════════════
-- StudyHub Phase 10: community moderation and safeguarding
-- Run AFTER SUPABASE_PHASE3.sql. Safe to run more than once.
-- Adds: post_reports, moderation_log, and staff delete policies.
-- Reuses the Phase 3 helper functions public.is_moderator() and
-- public.is_owner().
-- ════════════════════════════════════════════════════════════

-- ── Post reports ──────────────────────────────────────────────
create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null default 'Other',
  note text,
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.post_reports enable row level security;

-- Reporters file their own reports; staff (and the reporter) can read; staff resolve.
drop policy if exists post_reports_insert_own on public.post_reports;
create policy post_reports_insert_own on public.post_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

drop policy if exists post_reports_select on public.post_reports;
create policy post_reports_select on public.post_reports
  for select to authenticated
  using (reporter_id = auth.uid() or public.is_moderator() or public.is_owner());

drop policy if exists post_reports_update_staff on public.post_reports;
create policy post_reports_update_staff on public.post_reports
  for update to authenticated
  using (public.is_moderator() or public.is_owner())
  with check (public.is_moderator() or public.is_owner());

create index if not exists post_reports_status_idx on public.post_reports(status);
create index if not exists post_reports_post_idx on public.post_reports(post_id);

-- ── Moderation log ────────────────────────────────────────────
create table if not exists public.moderation_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.moderation_log enable row level security;

-- Only staff can write to or read the moderation log.
drop policy if exists moderation_log_insert_staff on public.moderation_log;
create policy moderation_log_insert_staff on public.moderation_log
  for insert to authenticated
  with check ((public.is_moderator() or public.is_owner()) and actor_id = auth.uid());

drop policy if exists moderation_log_select_staff on public.moderation_log;
create policy moderation_log_select_staff on public.moderation_log
  for select to authenticated
  using (public.is_moderator() or public.is_owner());

create index if not exists moderation_log_created_idx on public.moderation_log(created_at desc);

-- ── Staff moderation: allow moderators/owners to delete any post or comment ──
-- These are additive to the Phase 3 author-only delete policies (policies are OR'd).
drop policy if exists posts_delete_staff on public.posts;
create policy posts_delete_staff on public.posts
  for delete to authenticated
  using (public.is_moderator() or public.is_owner());

drop policy if exists post_comments_delete_staff on public.post_comments;
create policy post_comments_delete_staff on public.post_comments
  for delete to authenticated
  using (public.is_moderator() or public.is_owner());
