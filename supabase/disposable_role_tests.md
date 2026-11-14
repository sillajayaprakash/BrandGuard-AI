# Disposable Supabase Role Integration Tests

> **Disposable project only.** These steps are for a separate, empty Supabase project created solely for testing. Never run them against production or a project containing real users or data. Before any write operation, independently verify the project name and project reference in the Supabase Dashboard and confirm that the project is disposable. Stop if either check is uncertain.
>
> This document contains Sections 1 through 6. It does not apply SQL or connect to a project by itself.

## Section 1 — Apply migrations and verify schema

### Apply the migration

Before any database write, independently verify again that the selected project is the empty disposable project and that its Dashboard project reference matches the intended target. In the verified disposable project's SQL Editor, apply the current repository migration files **verbatim** in this order:

1. `supabase/brandguard_user_roles.sql`
2. `supabase/brandguard_revisions.sql`

Do not copy or maintain a second version of either migration in this document. Apply each as a migration operation, separately from the read-only checks below. After the role migration, bootstrap the first admin only for a verified Auth user UUID, using the commented instructions in `brandguard_user_roles.sql`.

Configure the app server for this same disposable project with `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. Keep `SUPABASE_SERVICE_ROLE_KEY` server-side; never commit it or expose it to browser code or API responses. Set `APP_ORIGIN` only if a custom origin requires it. `GEMINI_API_KEY` is optional and unrelated to revision persistence.

### Read-only schema checks

Run these checks in the disposable project's SQL Editor after applying the migration. They only read catalog/schema metadata.

#### Table and columns

```sql
select table_schema, table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'brandguard_user_roles'
order by ordinal_position;
```

**Expected:** exactly these columns, in order: `user_id` (UUID, non-null), `role` (text, non-null, default `'user'`), `assigned_by` (UUID, nullable), `created_at` (timestamp with time zone, non-null, default `now()`), and `updated_at` (timestamp with time zone, non-null, default `now()`).

**Failure:** no rows, extra/missing columns, or a type/nullability/default mismatch. Stop and compare the migration application with the current source file.

#### Primary key, foreign keys, and role constraint

```sql
select constraint_row.conname,
       constraint_row.contype,
       pg_catalog.pg_get_constraintdef(constraint_row.oid) as definition
from pg_catalog.pg_constraint as constraint_row
join pg_catalog.pg_class as table_row
  on table_row.oid = constraint_row.conrelid
join pg_catalog.pg_namespace as schema_row
  on schema_row.oid = table_row.relnamespace
where schema_row.nspname = 'public'
  and table_row.relname = 'brandguard_user_roles'
order by constraint_row.contype, constraint_row.conname;
```

**Expected:** a primary key on `user_id`; a foreign key from `user_id` to `auth.users(id)` with `ON DELETE CASCADE`; a foreign key from `assigned_by` to `auth.users(id)` with `ON DELETE SET NULL`; and a check constraint restricting `role` to `user`, `reviewer`, or `admin`. Constraint names may be PostgreSQL-generated; verify the definitions, not assumed names.

**Failure:** any expected constraint or referenced table/column is missing, or a delete action/role set differs from the migration.

#### Row-level security and policies

```sql
select relation.relrowsecurity as rls_enabled,
       relation.relforcerowsecurity as rls_forced
from pg_catalog.pg_class as relation
join pg_catalog.pg_namespace as schema_row
  on schema_row.oid = relation.relnamespace
where schema_row.nspname = 'public'
  and relation.relname = 'brandguard_user_roles';
```

```sql
select policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename = 'brandguard_user_roles';
```

**Expected:** one table result with `rls_enabled = true`. The policy query returns zero rows; the migration intentionally creates no policies.

**Failure:** RLS is disabled or any policy is present. Stop and investigate before inserting fixtures.

#### Table grants

The following is a **diagnostic listing only**. Its results may depend on which roles are enabled for the SQL Editor session. Do not use this listing by itself to determine pass/fail.

```sql
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'brandguard_user_roles'
  and grantee in ('anon', 'authenticated', 'service_role')
order by grantee, privilege_type;
```

The following `has_table_privilege` query is the **authoritative effective-privilege check for this test plan**. It checks effective table privileges for each named Supabase role.

```sql
select role_name,
       pg_catalog.has_table_privilege(role_name::name, 'public.brandguard_user_roles', 'SELECT') as can_select,
       pg_catalog.has_table_privilege(role_name::name, 'public.brandguard_user_roles', 'INSERT') as can_insert,
       pg_catalog.has_table_privilege(role_name::name, 'public.brandguard_user_roles', 'UPDATE') as can_update,
       pg_catalog.has_table_privilege(role_name::name, 'public.brandguard_user_roles', 'DELETE') as can_delete
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
order by role_name;
```

**Expected:** `anon` and `authenticated` have no table privileges. `service_role` has `SELECT`, `INSERT`, and `UPDATE`, but not `DELETE`, matching the migration's explicit grants. RLS remains enabled regardless of the service-role grant.

**Failure:** browser roles have any table privilege, or service-role privileges differ from the migration. Do not proceed with role tests until resolved.

#### Functions, arguments, security attributes, and function grants

```sql
select procedure_row.proname as function_name,
       pg_catalog.pg_get_function_identity_arguments(procedure_row.oid) as identity_arguments,
       procedure_row.proargnames as argument_names,
       procedure_row.prosecdef as security_definer,
       procedure_row.proconfig as function_settings
from pg_catalog.pg_proc as procedure_row
join pg_catalog.pg_namespace as schema_row
  on schema_row.oid = procedure_row.pronamespace
where schema_row.nspname = 'public'
  and procedure_row.proname in (
    'brandguard_set_role_updated_at',
    'brandguard_assign_user_role',
    'brandguard_prevent_last_admin_delete'
  )
order by procedure_row.proname;
```

**Expected:** all three functions exist. For `brandguard_assign_user_role`, verify `proargnames` contains the ordered names `p_user_id`, `p_role`, and `p_assigned_by`; use `identity_arguments` separately to verify the identifying argument types `uuid, text, uuid` (do not rely on that formatted signature to establish parameter names). The function is not `SECURITY DEFINER` and has an empty `search_path` setting. `brandguard_prevent_last_admin_delete` is `SECURITY DEFINER` with an empty `search_path` setting. `brandguard_set_role_updated_at` has no explicit arguments and an empty `search_path` setting.

```sql
select
  pg_catalog.has_function_privilege('service_role', 'public.brandguard_assign_user_role(uuid,text,uuid)', 'EXECUTE') as service_can_assign,
  pg_catalog.has_function_privilege('anon', 'public.brandguard_assign_user_role(uuid,text,uuid)', 'EXECUTE') as anon_can_assign,
  pg_catalog.has_function_privilege('authenticated', 'public.brandguard_assign_user_role(uuid,text,uuid)', 'EXECUTE') as authenticated_can_assign,
  pg_catalog.has_function_privilege('anon', 'public.brandguard_set_role_updated_at()', 'EXECUTE') as anon_can_run_updated_at,
  pg_catalog.has_function_privilege('authenticated', 'public.brandguard_set_role_updated_at()', 'EXECUTE') as authenticated_can_run_updated_at,
  pg_catalog.has_function_privilege('anon', 'public.brandguard_prevent_last_admin_delete()', 'EXECUTE') as anon_can_run_delete_guard,
  pg_catalog.has_function_privilege('authenticated', 'public.brandguard_prevent_last_admin_delete()', 'EXECUTE') as authenticated_can_run_delete_guard;
```

**Expected:** `service_can_assign = true`; every browser-role result is `false`. The trigger functions are invoked by their triggers, not directly by browser roles.

**Failure:** an expected function is missing, its arguments/security setting differs, or a browser role can execute a privileged function. Stop before fixture setup.

#### Triggers and advisory-lock key

```sql
select trigger_row.tgname as trigger_name,
       procedure_row.proname as function_name,
       pg_catalog.pg_get_triggerdef(trigger_row.oid) as trigger_definition
from pg_catalog.pg_trigger as trigger_row
join pg_catalog.pg_class as table_row
  on table_row.oid = trigger_row.tgrelid
join pg_catalog.pg_namespace as schema_row
  on schema_row.oid = table_row.relnamespace
join pg_catalog.pg_proc as procedure_row
  on procedure_row.oid = trigger_row.tgfoid
where not trigger_row.tgisinternal
  and schema_row.nspname = 'public'
  and table_row.relname = 'brandguard_user_roles'
order by trigger_row.tgname;
```

```sql
select procedure_row.proname as function_name,
       pg_catalog.strpos(pg_catalog.pg_get_functiondef(procedure_row.oid), '731904268511') > 0 as contains_shared_advisory_lock_key,
       pg_catalog.pg_get_functiondef(procedure_row.oid) as definition
from pg_catalog.pg_proc as procedure_row
join pg_catalog.pg_namespace as schema_row
  on schema_row.oid = procedure_row.pronamespace
where schema_row.nspname = 'public'
  and procedure_row.proname in (
    'brandguard_assign_user_role',
    'brandguard_prevent_last_admin_delete'
  )
order by procedure_row.proname;
```

**Expected:** `brandguard_user_roles_updated_at` is a `BEFORE UPDATE` trigger invoking `brandguard_set_role_updated_at`; `brandguard_user_roles_preserve_last_admin` is a `BEFORE DELETE` trigger invoking `brandguard_prevent_last_admin_delete`. The definition check returns `true` for both role-assignment and delete-guard functions, and each printed definition contains the same key `731904268511`.

**Failure:** either trigger is missing/misattached, either function differs, or the shared key check is false. No concurrency conclusion can be drawn from catalog inspection alone.

#### Revision table, RLS, and grants

Check the revision table columns after applying the second migration:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'brandguard_revisions'
order by ordinal_position;
```

**Expected:** `id` UUID; `owner_id` UUID; `version_number` integer; `title` text; `preset_id` text; `content` text; `score` integer; `status` text; `issues_count`, `critical_count`, `warning_count`, and `advisory_count` integers; `author` and `notes` text; `reviewed_by` UUID; `reviewed_at` timestamp with time zone; and `created_at` timestamp with time zone. `id`, `owner_id`, `version_number`, `title`, `content`, `score`, `status`, all issue counts, `author`, and `created_at` are non-null. Stop if the schema differs from the migration.

```sql
select relation.relrowsecurity as rls_enabled,
       relation.relforcerowsecurity as rls_forced
from pg_catalog.pg_class as relation
join pg_catalog.pg_namespace as schema_row on schema_row.oid = relation.relnamespace
where schema_row.nspname = 'public' and relation.relname = 'brandguard_revisions';

select policyname, roles, cmd, qual, with_check
from pg_catalog.pg_policies
where schemaname = 'public' and tablename = 'brandguard_revisions';

select role_name,
       pg_catalog.has_table_privilege(role_name::name, 'public.brandguard_revisions', 'SELECT') as can_select,
       pg_catalog.has_table_privilege(role_name::name, 'public.brandguard_revisions', 'INSERT') as can_insert,
       pg_catalog.has_table_privilege(role_name::name, 'public.brandguard_revisions', 'UPDATE') as can_update,
       pg_catalog.has_table_privilege(role_name::name, 'public.brandguard_revisions', 'DELETE') as can_delete
from (values ('anon'), ('authenticated'), ('service_role')) as roles(role_name)
order by role_name;
```

**Expected:** RLS is enabled; no policies are present; `anon` and `authenticated` have no table privileges; `service_role` has `SELECT`, `INSERT`, `UPDATE`, and `DELETE`. These grants permit the trusted backend's service client to work; request ownership and reviewer permissions are enforced by the authenticated application server. Do not proceed if browser roles have privileges or a policy is present.

## Section 2 — Create synthetic fixtures and test role assignment

### Safeguards and user creation

Before creating users or role rows, re-check in the Supabase Dashboard that the active project is the disposable test project, confirm its project reference, and verify that it contains no real users/data. Use test-only email addresses and passwords. Stop if there is any doubt about the target project.

#### Optional local fixture script (Windows)

The repository includes `scripts/create_disposable_auth_fixtures.js` for creating the six Auth users. It requires the project approval file and a UUID registry in the ignored `.local` directory. Before each run:

1. Open the Supabase Dashboard and independently verify that the selected project is the disposable **BrandGuard-AI-Test** project. Copy its project reference from the Dashboard; do not derive it from `SUPABASE_URL`.
2. Create `.local\disposable-project-approval.json` manually with exactly this JSON shape, replacing the placeholder with the Dashboard reference:

   ```json
   { "projectName": "BrandGuard-AI-Test", "projectRef": "<20-character-dashboard-reference>" }
   ```

   The script never creates or changes this approval file. It requires the approval reference, the reference parsed from `SUPABASE_URL`, and the explicit command-line confirmation to match. Missing, malformed, writable, or inconsistent approval aborts before any Auth Admin API request.
3. Apply and inspect NTFS ACLs. The current Windows user needs full control of `.local` so the script can maintain the UUID registry, while the approval file should be read-only to that user:

   ```powershell
   New-Item -ItemType Directory -Force .local | Out-Null
   icacls .local /inheritance:r
   icacls .local /grant:r "$($env:USERNAME):(OI)(CI)(F)" "SYSTEM:(OI)(CI)(F)"
   # Create and save the approval JSON manually, then restrict that file:
   icacls .local\disposable-project-approval.json /inheritance:r
   icacls .local\disposable-project-approval.json /grant:r "$($env:USERNAME):(R)" "SYSTEM:(F)"
   icacls .local
   icacls .local\disposable-project-approval.json
   ```

   Inspect both `icacls` results and confirm only the intended principals have access, with no write permission on the approval file. The script also checks that its process cannot write that file. ACLs protect against ordinary access by other Windows accounts; they do not protect against administrators, malware running as the current user, or copies made by backup/sync tools. `chmod` alone is not a substitute for NTFS ACLs.
4. From the project directory, after independently comparing the approved reference with the Dashboard again, run `node --env-file-if-exists=.env scripts/create_disposable_auth_fixtures.js --confirm-project-ref <reference-from-dashboard>`. The script compares all three references before listing users or creating any. It records only UUIDs returned by Auth Admin `createUser`; reruns verify those IDs by Auth Admin lookup. It never adopts an account by email or metadata. If an API call has an ambiguous outcome and the UUID was not durably recorded, stop and reconcile manually in the Dashboard; the script will not infer that identity later.

Create six users using the **Auth Admin API for that disposable project** from a trusted server-side/local administrative context. With the Supabase client, the operation is `supabase.auth.admin.createUser({ email, password, email_confirm: true })`; use a unique test-only email and password for each account, and read the returned `data.user.id`. The operation requires the project's administrative credential, which must remain in a private environment/configuration store; never place it in frontend code, source files, or this plan, and never print it. Do not create users by inserting into `auth.users`.

For each successful Auth Admin API response, record its returned `user.id` exactly and map it to the fixture label below. These IDs are generated by Supabase; do not guess or construct them.

| Fixture label | Actual UUID returned by Auth Admin API | Initial role |
|---|---|---|
| `ADMIN_A` | Record returned UUID | `admin` |
| `ADMIN_B` | Record returned UUID | `admin` |
| `USER_C` | Record returned UUID | `user` |
| `USER_D` | Record returned UUID | `user` |
| `USER_E` | Record returned UUID | `user` |
| `USER_F` | Record returned UUID | `user` |

Confirm all six accounts exist in the disposable project's Auth Users page and that every recorded UUID matches its returned Auth Admin API user ID before continuing.

### Trusted one-time role bootstrap

The first two admin rows must be bootstrapped manually by a trusted operator in the disposable project's SQL Editor after the migration has been applied and the UUID mapping has been checked. Use the actual returned UUIDs for `ADMIN_A`, `ADMIN_B`, and `USER_C` through `USER_F`; set `assigned_by` to `null` for this one-time bootstrap, as shown by the migration's documented bootstrap approach. The table's Auth foreign keys verify that each supplied UUID belongs to an existing Auth user.

The following is a **substitution template, not directly executable as written**. Replace every placeholder with the exact UUID returned by the Auth Admin API for the matching fixture, then re-check the active project before running it. Do not substitute guessed or constructed IDs.

```sql
insert into public.brandguard_user_roles (user_id, role, assigned_by)
values
  ('<ADMIN_A_UUID>'::uuid, 'admin', null),
  ('<ADMIN_B_UUID>'::uuid, 'admin', null),
  ('<USER_C_UUID>'::uuid, 'user', null),
  ('<USER_D_UUID>'::uuid, 'user', null),
  ('<USER_E_UUID>'::uuid, 'user', null),
  ('<USER_F_UUID>'::uuid, 'user', null);
```

The bootstrap is a privileged setup operation, not a browser operation. Do not expose a setup endpoint or permit public registration to assign a role. The SQL Editor statement must not be run until every placeholder is replaced with the matching captured UUID. Verify the inserted rows and roles before using the application. Do not bootstrap a role for an ID that was not returned for one of these six synthetic users.

### Role assignment tests

Use the following distinctions when exercising the tests:

- **Browser:** use only normal authenticated application requests. Do not call the administrative RPC or supply a role/actor identity from the browser.
- **Application server:** test `POST /api/admin/users/role` with an authenticated `ADMIN_A` or `ADMIN_B` session. Verify that this route derives `assigned_by` from the authenticated admin and assigns the role to `USER_C`. `lib/roles.js` only forwards the `assignedBy` value it receives; it does not authenticate the actor. Therefore, verify actor identity through the authenticated application route, not by testing `lib/roles.js` alone.
- **Trusted RPC check:** the SQL function is granted to `service_role`, not `anon` or `authenticated`. To test the database function's own validation messages, invoke `public.brandguard_assign_user_role(p_user_id, p_role, p_assigned_by)` only from a trusted server-side test context with service-role authority. Keep that credential private and do not add it to the test plan or frontend.

| Test | Operation | Expected result | Failure condition |
|---|---|---|---|
| Valid assignment | As an authenticated admin through the application server, assign `USER_C` the `reviewer` role. | Success; `USER_C` has role `reviewer`, and `assigned_by` is the verified admin's captured UUID. | Request succeeds for a non-admin, recorded actor differs from the authenticated admin, or role is not updated. |
| Invalid role | In the trusted RPC test context, call the assignment function for `USER_C` using an unsupported role value. | RPC fails with message `INVALID_ROLE` (SQLSTATE `22023`); no role change occurs. The application route may reject the value earlier with HTTP 400, which alone does not test the database function. | RPC succeeds, message differs, or role changes. |
| Missing/deleted target | After tests that require all six fixtures, delete `USER_F` through the disposable project's Auth Admin API and confirm deletion. `USER_F` is a non-admin, so this does not target the final-admin guard. From the trusted RPC context, call the assignment function using `USER_F`'s captured, now-deleted UUID and an existing admin UUID for `p_assigned_by`. | RPC fails with message `USER_NOT_FOUND` (SQLSTATE `P0002`); no role row is created. The normal application route may detect the missing Auth user before calling the RPC; that separately should report `USER_NOT_FOUND`. | RPC succeeds, the database error is not mapped to `USER_NOT_FOUND`, or a role row remains for the deleted UUID. |

After this test, `USER_F` is unavailable for any later test in this plan because its Auth account was deleted. Do not attempt to reuse its UUID or recreate it under that fixture label.

After each test, inspect only the test users' role rows and verify results against the captured UUID map. Do not run these write operations against any project except the verified disposable test project.

## Section 3 — Test shared revisions and authorization

Use only the fixture accounts created in Section 2. `USER_F` has been deleted and must not be used. Start with `ADMIN_A` and `ADMIN_B` assigned `admin`, `USER_C` assigned `reviewer`, and `USER_D` and `USER_E` assigned `user`. If an earlier check changed a role, restore this state through an authenticated admin session. Send requests through the running app using each fixture account's own authenticated session. Do not fabricate identities or role claims.

1. `USER_E` runs `POST /api/check` and gets HTTP 200. Then save a draft with `POST /api/revisions`, providing `status: "draft"`, `content`, and any desired audit fields. Include forged `role`, `author`, `email`, `userId`, and `ownerId` values. Expect HTTP 201 and record the returned `revision.id`; confirm returned `ownerId` and author come from the authenticated user. The app creates the actual draft from its **Save Draft** action.
2. As `USER_E`, call `GET /api/revisions`. Confirm the saved draft is present. As unrelated normal user `USER_D`, call the same endpoint and confirm that draft is absent. `USER_D` must receive HTTP 403 if attempting a review write against the recorded ID, for example `POST /api/revisions` with `{ "revisionId": "<USER_E_REVISION_UUID>", "status": "approved" }`. A forged owner or role in the body must not change this result.
3. As reviewer `USER_C`, call `GET /api/revisions` and confirm the `USER_E` draft is visible. Review that existing draft with `POST /api/revisions` and JSON body `{ "revisionId": "<USER_E_REVISION_UUID>", "status": "changes_requested", "notes": "Please revise the claim." }`. Expect HTTP 200. Confirm the returned ID and owner are unchanged, status is `changes_requested`, and reviewer metadata identifies `USER_C`. This updates the existing draft; it does **not** create a new revision. Repeat against a separate newly saved draft with `status: "approved"` if testing approval. Only `approved` and `changes_requested` are valid review statuses.
4. As `ADMIN_A`, call `GET /api/revisions` and confirm shared drafts are visible. Test a review decision using the same existing-draft request shape and expect HTTP 200. `USER_C` must still receive HTTP 403 from `GET /api/admin/users` and `POST /api/admin/users/role`. As `ADMIN_A`, test user-role assignment through the existing admin route; verify `assigned_by` is `ADMIN_A`'s verified Auth UUID, not a body-supplied value.
5. Test history deletion with another disposable draft. As `USER_D`, save a draft, then call `DELETE /api/revisions`. Expect HTTP 200 and an empty `USER_D` history. As `USER_C` or `ADMIN_A`, confirm the separate `USER_E` revision remains. The delete operation clears only the authenticated owner's history, even when called by an admin/reviewer.
6. Restart the BrandGuard server without changing the disposable database. As `USER_C` or `ADMIN_A`, call `GET /api/revisions` again and confirm the `USER_E` revision and its review status remain. This verifies database persistence rather than in-process memory.

If the migration or server configuration is missing, revision endpoints should fail with a storage/configuration error (HTTP 503); do not interpret that as a passing workflow check. At the end, restore `ADMIN_A` and `ADMIN_B` to `admin`, `USER_C` to `reviewer` or another non-admin role, and `USER_E` to `user`. Keep `USER_D` as a user. Do not recreate or use `USER_F`.

## Section 4 — Test final-admin demotion and deletion protection

Before any write, re-verify the disposable project name/reference. Confirm the fixture state: exactly `ADMIN_A` and `ADMIN_B` are admins; `USER_C`, `USER_D`, and `USER_E` are non-admins; `USER_F` is absent. Keep both admins in place until the non-admin deletion checks are complete.

### Non-admin role-row deletion

Use the actual captured `USER_C` UUID in this disposable-project SQL Editor transaction. This tests that the delete trigger permits a non-admin role-row deletion. Roll back so the role row and fixture state are restored for the later tests.

```sql
begin;

delete from public.brandguard_user_roles
where user_id = '<USER_C_UUID>'::uuid
  and role <> 'admin'
returning user_id;

select exists (
  select 1
  from public.brandguard_user_roles
  where user_id = '<USER_C_UUID>'::uuid
) as user_c_role_row_remains;

rollback;
```

**Expected:** `DELETE ... RETURNING` returns exactly one row, with `USER_C`'s captured UUID, and the following check returns `false` before rollback. After rollback, `USER_C`'s original role row is restored. No returned row, a blocked deletion, or a missing restored row after rollback is a failure.

### Non-admin Auth-user deletion and cascade

Confirm `USER_D` is not an admin. Using the disposable project's trusted Auth Admin API, delete `USER_D` by its captured UUID. Do not guess an HTTP status or error body for this Auth Admin API operation; record the API result. Then run this read-only SQL check:

```sql
select exists (
         select 1 from auth.users where id = '<USER_D_UUID>'::uuid
       ) as auth_user_remains,
       exists (
         select 1 from public.brandguard_user_roles where user_id = '<USER_D_UUID>'::uuid
       ) as role_row_remains;
```

**Expected:** the Auth Admin API reports success, and both values are `false`, showing that the non-admin Auth user deletion succeeded and the `ON DELETE CASCADE` removed its role row. If the API reports failure or either row remains, stop. `USER_D` is unavailable for later tests; do not recreate it.

### Final-admin demotion

Keep both fixture admins until this test setup. Through authenticated `ADMIN_A`, use `POST /api/admin/users/role` to demote `ADMIN_B` to `user`. The current server returns HTTP 200 for a successful assignment. Verify that `ADMIN_A` is now the only admin.

Then, through `ADMIN_A`, attempt to demote `ADMIN_A` to `user` using the same route. The current server maps the role-store `LAST_ADMIN` error to HTTP 409 with message `The last administrator cannot be demoted or removed.` Verify `ADMIN_A` remains an admin. Any success or a different server response is a failure requiring source/version review.

### Final-admin deletion through the Auth cascade

With `ADMIN_A` as the sole admin, test the database trigger in a disposable SQL Editor transaction. Replace the placeholder with `ADMIN_A`'s captured UUID. The inner exception block catches only the expected SQLSTATE and checks the exact migration error message; the transaction is rolled back after the assertions.

```sql
begin;

do $$
declare
  caught_last_admin boolean := false;
begin
  begin
    delete from auth.users
    where id = '<ADMIN_A_UUID>'::uuid;
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'LAST_ADMIN' then
        raise;
      end if;
      caught_last_admin := true;
  end;

  if not caught_last_admin then
    raise exception 'Expected final-admin deletion to fail with LAST_ADMIN';
  end if;

  if not exists (select 1 from auth.users where id = '<ADMIN_A_UUID>'::uuid) then
    raise exception 'Auth user was deleted despite the final-admin guard';
  end if;

  if not exists (
    select 1 from public.brandguard_user_roles
    where user_id = '<ADMIN_A_UUID>'::uuid and role = 'admin'
  ) then
    raise exception 'Final-admin role row is missing after rejected deletion';
  end if;
end;
$$;

rollback;
```

**Expected:** the `DO` block completes, confirming SQLSTATE `P0001`, message `LAST_ADMIN`, and that both the Auth user and admin role row remain. The outer rollback leaves fixture state unchanged. A deletion, a different error message, or a failed assertion is a failure.

Before Section 5, restore `ADMIN_B` to `admin` through the authenticated application admin route as `ADMIN_A`. Confirm the starting state is again exactly two admins, `ADMIN_A` and `ADMIN_B`.

## Section 5 — Concurrent final-admin demotion test

This is a real database concurrency test and requires **two independent PostgreSQL sessions**. A sequential SQL Editor script or the existing JavaScript mock test cannot prove PostgreSQL transaction serialization.

Before starting, confirm that `ADMIN_A` and `ADMIN_B` are the only admins. `USER_C` and `USER_E` remain non-admins; `USER_D` and `USER_F` have been deleted and must not be used. Use a trusted database principal that can execute `public.brandguard_assign_user_role`; never put credentials in this document or browser code.

Run the following operations in separate sessions at `READ COMMITTED` isolation. Substitute only the captured fixture UUIDs.

**Session A:**

```sql
begin;
set transaction isolation level read committed;

select *
from public.brandguard_assign_user_role(
  '<ADMIN_A_UUID>'::uuid,
  'user',
  '<ADMIN_B_UUID>'::uuid
);
```

After Session A returns successfully, leave its transaction open. Then run Session B's transaction so it reaches the same advisory lock and waits. Once Session B is blocked, commit Session A:

```sql
commit;
```

**Session B:**

```sql
begin;
set transaction isolation level read committed;

select *
from public.brandguard_assign_user_role(
  '<ADMIN_B_UUID>'::uuid,
  'user',
  '<ADMIN_A_UUID>'::uuid
);
```

**Expected serialization:** Session A acquires transaction-scoped advisory lock `731904268511` and demotes `ADMIN_A`. Session B waits on that same lock. After Session A commits, Session B continues, observes the committed admin count, and fails with SQLSTATE `P0001` and message `LAST_ADMIN`. Roll back Session B's failed transaction after recording the error.

Finally, in a separate read-only query, verify exactly one admin remains in the role table and that it is one of the two fixture admins:

```sql
select count(*) as total_admins,
       count(*) filter (where user_id in ('<ADMIN_A_UUID>'::uuid, '<ADMIN_B_UUID>'::uuid)) as fixture_admins,
       count(*) filter (where user_id = '<ADMIN_B_UUID>'::uuid) as admin_b_count
from public.brandguard_user_roles
where role = 'admin';
```

**Expected:** `total_admins = 1`, `fixture_admins = 1`, and `admin_b_count = 1`; with the specified ordering, the surviving admin is `ADMIN_B`. If both demotions succeed, zero or two fixture admins remain, a different fixture survives, either operation returns another error, or the second session does not block and serialize as described, record the failure and stop. Do not treat mock-only concurrency results as proof of database behavior.

## Section 6 — Safe cleanup

After recording test results, the preferred cleanup is to delete the **entire disposable Supabase project** through the Supabase Dashboard. Reconfirm its project name and reference before deletion. Do not delete or alter any production project.

If retaining the disposable project instead:

1. Do not disable, drop, or bypass `brandguard_user_roles_preserve_last_admin` or `brandguard_prevent_last_admin_delete`.
2. Keep the surviving `ADMIN_A` or `ADMIN_B` role row as the one administrator. Do not delete that user's Auth account or role row.
3. The other admin was demoted by the successful Section 5 operation. It is now a non-admin and may be deleted through the disposable project's Auth Admin API; its role row should cascade away.
4. Delete remaining synthetic non-admin users (`USER_C` and `USER_E`) through the disposable project's Auth Admin API after confirming they are not admins. `USER_D` and `USER_F` were already deleted in Sections 4 and 2 respectively.
5. Verify only the intended surviving synthetic admin remains. Do not delete real data or any account outside the six fixture labels.

If the fixture state differs from these expectations or the surviving admin cannot be identified, do not run cleanup writes. Preserve the data and remove the disposable project only after confirming its identity.
