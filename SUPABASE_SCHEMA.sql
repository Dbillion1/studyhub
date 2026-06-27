-- StudyHub production backend schema
-- Run this in Supabase Dashboard → SQL Editor.

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

-- Users can read their own profile.
do $$ begin
  create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);
exception when duplicate_object then null; end $$;

-- Users can update only their own non-payment profile fields from the browser.
-- Payment fields are updated by Netlify Functions using the service-role key.
do $$ begin
  create policy "Users can update own learning profile"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);
exception when duplicate_object then null; end $$;
