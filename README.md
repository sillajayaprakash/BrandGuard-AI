# BrandGuard AI

BrandGuard AI helps marketing teams check content against brand guidelines before publication. It combines deterministic rules with optional Google Gemini analysis, factual-claim review, visual/accessibility checks, saved revision history, and human review workflows.

## Requirements

- Node.js 24 (or a compatible version that supports `--env-file-if-exists`) and npm.
- A Supabase project for sign-in, roles, and persistent revision history.
- `GEMINI_API_KEY` is optional and enables Gemini-powered analysis; the deterministic checks work without it.

## Install and run locally

```sh
git clone https://github.com/sillajayaprakash/BrandGuard-AI.git
cd BrandGuard-AI
npm install
```

Create a `.env` file in the project root and configure the server:

```dotenv
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
# Optional: only set this when using a custom origin not otherwise allowed.
# APP_ORIGIN=https://your-custom-origin.example
# Optional: enables Gemini analysis; unrelated to revision persistence.
# GEMINI_API_KEY=your_gemini_api_key
```

`SUPABASE_SERVICE_ROLE_KEY` is a privileged secret. It must remain in the server environment: never put it in browser code, expose it through an API, or commit it. Keep `.env` private. The anon/publishable key is used for browser sign-in and server-side token verification; it is not a substitute for the service-role key.

## Supabase setup

Apply the SQL files in the Supabase SQL Editor, in this order:

1. `supabase/brandguard_user_roles.sql`
2. `supabase/brandguard_revisions.sql`

Use the intended Supabase project and verify its project reference before applying SQL. For testing, use only an independently verified disposable project, never production. The application does not apply migrations automatically. See [supabase/brandguard_revisions.md](supabase/brandguard_revisions.md) and [supabase/disposable_role_tests.md](supabase/disposable_role_tests.md) for schema checks and end-to-end procedures.

### Create the initial administrator safely

1. Register the intended administrator through the normal application sign-up flow.
2. In the Supabase Dashboard for the verified project, locate that account in **Authentication > Users** and copy its exact user UUID. Confirm the project reference and account before proceeding.
3. As a trusted project administrator, use the SQL Editor to run the bootstrap `INSERT` commented at the end of `supabase/brandguard_user_roles.sql`, replacing the UUID placeholder with the verified Auth user UUID. Do not accept an unverified UUID or request-body identity as authorization.
4. Sign in as that account and confirm the admin controls are available. Assign additional roles through the application's admin user-management controls.

Do not bootstrap an administrator in production until the target project and account have been independently verified. The SQL bootstrap is an explicit privileged operation.

## Roles and capabilities

- **User:** run checks, save drafts, view and clear their own revision history.
- **Reviewer:** all user capabilities, plus view shared drafts and record `approved` or `changes_requested` decisions on existing drafts.
- **Admin:** reviewer capabilities, plus manage user roles through the admin dashboard. The role migration protects the final administrator from demotion or deletion.

The server verifies the signed-in Supabase identity and role for protected routes. Browser-supplied owner IDs or role claims do not grant access. Service-role database access is confined to the server.

## Start and test

Start the application:

```sh
npm start
```

Open `http://localhost:3000`. Authentication and persistent revision features require the Supabase environment variables and migrations above. Without `GEMINI_API_KEY`, Gemini analysis is unavailable but deterministic checks remain usable.

Run the automated test suite:

```sh
npm test
```

The automated test suite passed in the current development environment. These tests use mocks for database-backed behavior; real database concurrency behavior and Clear History deletion/persistence verification remain incomplete. Do not treat automated test success as proof that either migration is applied or that a real Supabase project has passed integration testing. Follow the disposable-project procedure in `supabase/disposable_role_tests.md` before relying on database behavior.

## Project files

- `public/` — browser application, styles, and client-side modules.
- `lib/` — rule checks, authentication/authorization, role and revision stores, and analysis helpers.
- `server.js` — HTTP server and protected API routes.
- `supabase/` — role/revision migrations and database setup/test documentation.
- `test/` — automated test suites, run with `npm test`.
- `scripts/` — guarded helpers for disposable-project test fixtures.

## Project information

- Hackathon: CodeTitans India 2026 Round 3
- Team: DEBUGGER
- Developer: Silla Jayaprakash
