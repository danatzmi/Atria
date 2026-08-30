# Atria

A beautiful digital binder for real-world projects. See `PRODUCT.md` for the
product definition and `CLAUDE.md` for development guidelines.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth,
Storage).

## Local setup

1. Install dependencies:

   ```
   npm install
   ```

2. Start the local Supabase stack (requires Docker):

   ```
   npx supabase start
   ```

   This applies the migrations in `supabase/migrations/` and prints your
   local API URL and keys.

3. Copy `.env.local.example` to `.env.local` and fill in the values printed
   by `supabase start` (`API URL` → `NEXT_PUBLIC_SUPABASE_URL`, `anon key` →
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `service_role key` →
   `SUPABASE_SERVICE_ROLE_KEY`).

4. Run the app:

   ```
   npm run dev
   ```

## Tests

```
npm run test
```

Runs the authorization test suite against the local Supabase instance
(`tests/authorization.test.ts`) — proves that Row Level Security prevents one
user from reading or writing another user's projects, folders, or files.
Requires `supabase start` to be running first.

## Database changes

Schema changes go in `supabase/migrations/` as new numbered SQL files. Apply
them locally with:

```
npx supabase db reset
```
