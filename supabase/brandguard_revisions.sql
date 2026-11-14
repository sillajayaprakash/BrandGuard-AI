-- Persistent BrandGuard revision history. Apply in the Supabase SQL Editor as a trusted admin.
-- The backend verifies the caller and uses its server-only service-role credential.
create table if not exists public.brandguard_revisions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  title text not null,
  preset_id text not null default 'apexTech',
  content text not null check (length(content) <= 1000000),
  score integer not null default 100 check (score between 0 and 100),
  status text not null default 'draft' check (status in ('draft', 'approved', 'changes_requested')),
  issues_count integer not null default 0 check (issues_count >= 0),
  critical_count integer not null default 0 check (critical_count >= 0),
  warning_count integer not null default 0 check (warning_count >= 0),
  advisory_count integer not null default 0 check (advisory_count >= 0),
  author text not null,
  notes text not null default '',
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists brandguard_revisions_owner_created_idx
  on public.brandguard_revisions (owner_id, created_at desc);
create index if not exists brandguard_revisions_status_created_idx
  on public.brandguard_revisions (status, created_at desc);

alter table public.brandguard_revisions enable row level security;
revoke all on table public.brandguard_revisions from public, anon, authenticated;
grant select, insert, update, delete on table public.brandguard_revisions to service_role;

-- No browser policies are created. Only authenticated server routes may read or write revisions.
