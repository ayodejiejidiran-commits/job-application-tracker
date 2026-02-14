create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  location text,
  years_experience int not null default 0,
  headline text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists job_criteria (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  titles text[] default '{}',
  locations text[] default '{}',
  remote_only boolean default false,
  min_years int default 0,
  max_years int default 50,
  include_keywords text[] default '{}',
  exclude_keywords text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('linkedin', 'indeed', 'glassdoor', 'other')),
  title text not null,
  company text,
  location text,
  url text not null,
  description text,
  posted_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  status text not null check (status in ('DRAFT', 'READY_TO_REVIEW', 'APPLIED', 'ARCHIVED')) default 'DRAFT',
  applied_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table if not exists resume_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text default 'default',
  resume_json jsonb not null default '{}'::jsonb,
  pdf_path text,
  created_at timestamptz not null default now()
);

create table if not exists drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  cover_letter text not null default '',
  answers jsonb not null default '{}'::jsonb,
  resume_version_id uuid references resume_versions(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, application_id)
);

create table if not exists job_matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  score int not null default 0,
  matched_keywords text[] not null default '{}',
  missing_keywords text[] not null default '{}',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, job_id)
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists reminder_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal_min int not null default 5,
  goal_max int not null default 10,
  last_reminded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
alter table job_criteria enable row level security;
alter table jobs enable row level security;
alter table applications enable row level security;
alter table resume_versions enable row level security;
alter table drafts enable row level security;
alter table job_matches enable row level security;
alter table notifications enable row level security;
alter table reminder_settings enable row level security;

drop policy if exists profiles_owner on profiles;
create policy profiles_owner on profiles
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists criteria_owner on job_criteria;
create policy criteria_owner on job_criteria
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists jobs_owner on jobs;
create policy jobs_owner on jobs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists apps_owner on applications;
create policy apps_owner on applications
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists resume_owner on resume_versions;
create policy resume_owner on resume_versions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists drafts_owner on drafts;
create policy drafts_owner on drafts
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists job_matches_owner on job_matches;
create policy job_matches_owner on job_matches
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists notifications_owner on notifications;
create policy notifications_owner on notifications
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists reminders_owner on reminder_settings;
create policy reminders_owner on reminder_settings
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop trigger if exists set_profiles_updated_at on profiles;
create trigger set_profiles_updated_at before update on profiles
for each row execute function public.set_updated_at();

drop trigger if exists set_job_criteria_updated_at on job_criteria;
create trigger set_job_criteria_updated_at before update on job_criteria
for each row execute function public.set_updated_at();

drop trigger if exists set_jobs_updated_at on jobs;
create trigger set_jobs_updated_at before update on jobs
for each row execute function public.set_updated_at();

drop trigger if exists set_applications_updated_at on applications;
create trigger set_applications_updated_at before update on applications
for each row execute function public.set_updated_at();

drop trigger if exists set_drafts_updated_at on drafts;
create trigger set_drafts_updated_at before update on drafts
for each row execute function public.set_updated_at();

drop trigger if exists set_job_matches_updated_at on job_matches;
create trigger set_job_matches_updated_at before update on job_matches
for each row execute function public.set_updated_at();

drop trigger if exists set_reminder_settings_updated_at on reminder_settings;
create trigger set_reminder_settings_updated_at before update on reminder_settings
for each row execute function public.set_updated_at();
