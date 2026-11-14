-- BrandGuard AI application roles. Run in the Supabase SQL Editor as a trusted project administrator.
create table if not exists public.brandguard_user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'user' check (role in ('user', 'reviewer', 'admin')),
  assigned_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.brandguard_set_role_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists brandguard_user_roles_updated_at on public.brandguard_user_roles;
create trigger brandguard_user_roles_updated_at
before update on public.brandguard_user_roles
for each row execute function public.brandguard_set_role_updated_at();
revoke all on function public.brandguard_set_role_updated_at() from public, anon, authenticated;

alter table public.brandguard_user_roles enable row level security;
revoke all on table public.brandguard_user_roles from anon, authenticated, service_role;
grant select, insert, update on table public.brandguard_user_roles to service_role;

-- No policies are intentionally created: browser roles have no direct table access.
-- The backend uses its server-only Supabase administrative credential after verifying the caller.

-- Serialize every application role mutation so concurrent admin demotions cannot both
-- observe the old administrator count. This function runs as service_role (not SECURITY DEFINER)
-- and remains callable only through the trusted backend.
create or replace function public.brandguard_assign_user_role(
  p_user_id uuid,
  p_role text,
  p_assigned_by uuid
)
returns setof public.brandguard_user_roles
language plpgsql
set search_path = ''
as $$
declare
  v_existing_role text;
  admin_count bigint;
begin
  if p_role is null or p_role not in ('user', 'reviewer', 'admin') then
    raise exception using errcode = '22023', message = 'INVALID_ROLE';
  end if;

  -- One transaction-scoped lock shared with the last-admin delete trigger below.
  perform pg_catalog.pg_advisory_xact_lock(731904268511::bigint);

  select roles.role
    into v_existing_role
    from public.brandguard_user_roles as roles
    where roles.user_id = p_user_id
    for update;

  select pg_catalog.count(*)
    into admin_count
    from public.brandguard_user_roles as roles
    where roles.role = 'admin';

  if v_existing_role = 'admin' and p_role <> 'admin' and admin_count <= 1 then
    raise exception using errcode = 'P0001', message = 'LAST_ADMIN';
  end if;

  return query
    insert into public.brandguard_user_roles as role_record (user_id, role, assigned_by)
    values (p_user_id, p_role, p_assigned_by)
    on conflict (user_id) do update
      set role = excluded.role,
          assigned_by = excluded.assigned_by
    returning role_record.*;
exception
  when foreign_key_violation then
    raise exception using errcode = 'P0002', message = 'USER_NOT_FOUND';
end;
$$;

revoke all on function public.brandguard_assign_user_role(uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.brandguard_assign_user_role(uuid, text, uuid) to service_role;

-- Protect the final administrator against role-row deletion, including deletion cascaded
-- from auth.users. SECURITY DEFINER is needed because the Auth deletion transaction may
-- not have SELECT permission on this application table. The fixed search_path and qualified
-- names prevent object-shadowing; browser roles cannot execute this trigger function.
create or replace function public.brandguard_prevent_last_admin_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_count bigint;
begin
  if old.role <> 'admin' then
    return old;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(731904268511::bigint);
  select pg_catalog.count(*)
    into admin_count
    from public.brandguard_user_roles as roles
    where roles.role = 'admin';

  if admin_count <= 1 then
    raise exception using errcode = 'P0001', message = 'LAST_ADMIN';
  end if;
  return old;
end;
$$;

drop trigger if exists brandguard_user_roles_preserve_last_admin on public.brandguard_user_roles;
create trigger brandguard_user_roles_preserve_last_admin
before delete on public.brandguard_user_roles
for each row execute function public.brandguard_prevent_last_admin_delete();
revoke all on function public.brandguard_prevent_last_admin_delete() from public, anon, authenticated;

-- First-admin bootstrap: register the trusted account normally, then run manually after verifying
-- its UUID in Authentication > Users:
-- insert into public.brandguard_user_roles (user_id, role, assigned_by)
-- values ('<verified-auth.users-uuid>', 'admin', null)
-- on conflict (user_id) do update set role = 'admin', updated_at = now();
