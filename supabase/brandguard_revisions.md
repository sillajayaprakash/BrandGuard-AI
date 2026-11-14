# Persistent revision history setup

## Disposable-project safety

All database setup and verification described here must use a separate, empty Supabase project created for testing. Before any database write, independently verify the project name and reference in the Supabase Dashboard. Never apply these migrations or run these database tests against production or a project containing real users or data. Stop if the target is uncertain.

## Migration order

Using the verified disposable project's SQL Editor and a trusted project administrator, apply the current repository migration files verbatim, in this order:

1. `supabase/brandguard_user_roles.sql`
2. `supabase/brandguard_revisions.sql`

Do not copy the SQL into a second maintained migration source. The first migration creates the role table and protects its last administrator. The second creates persistent revision storage and does not alter the role table, its functions, or its triggers. Neither migration is applied by the application or by this document.

After applying the role migration, create the first admin role only for a verified UUID belonging to an account in this disposable project, following the bootstrap instructions at the bottom of `brandguard_user_roles.sql`.

## Server configuration

Configure these variables in the server environment:

- `SUPABASE_URL` — URL of the same Supabase project.
- `SUPABASE_ANON_KEY` — that project's anon/publishable key, used for access-token verification and browser sign-in.
- `SUPABASE_SERVICE_ROLE_KEY` — that project's service-role key, used by the server to access role and revision tables.

`SUPABASE_SERVICE_ROLE_KEY` is a privileged secret. Keep it server-side; never put it in browser code, serve it through an API, commit it, or include it in client configuration. `/api/auth/config` is intended to return only the Supabase URL and publishable key.

Set `APP_ORIGIN` only when the application is served from a custom origin that the server does not already allow. `GEMINI_API_KEY` is optional for AI checks and unrelated to revision persistence.

The revision API returns a storage configuration/unavailable error until the migrations and required server variables are in place. Do not treat a successful build or mocked test as proof that the disposable database has been configured.

## Revision access behavior

- A normal user can list and delete only revisions owned by their verified account. Saving a draft sets its owner from the verified access token; identity or owner fields in the request body are ignored.
- A reviewer or admin can list shared revisions and review an existing draft.
- A review is an update to the existing draft. It does not create a new revision. Send `POST /api/revisions` with `revisionId`, `status` (`approved` or `changes_requested`), and optional `notes`. The server checks the reviewer's verified role and updates the existing row's review status and reviewer metadata.
- Clearing history deletes only the authenticated user's own revisions, including when the caller is a reviewer or admin.

See `supabase/disposable_role_tests.md` for the disposable-project schema and end-to-end verification steps. These setup steps do not connect to or modify any database by themselves.
