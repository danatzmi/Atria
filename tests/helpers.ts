// Shared setup for tests that exercise Supabase against the local dev stack.
// Requires `npx supabase start` and `.env.local` populated (see
// `.env.local.example`).

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local doesn't exist — requireEnv() below will fail with a clear message.
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export function requireEnv() {
  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
    throw new Error(
      "Missing Supabase env vars. Run `npx supabase start` and copy the printed " +
        "values into `.env.local` (see `.env.local.example`) before running tests."
    );
  }
}

export function createAdminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

export async function createTestUser(admin: SupabaseClient, emailPrefix: string) {
  const email = `${emailPrefix}-${randomUUID()}@example.com`;
  const password = "password123";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw error ?? new Error("failed to create test user");
  }
  return { id: data.user.id, email, password };
}

export async function signInAs(email: string, password: string) {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;

  // Local Docker's Postgres clock can lag the host by a few ms right after
  // a fresh sign-in, which makes PostgREST reject the just-issued JWT with
  // PGRST303 ("JWT issued at future") on the very next request. A short
  // grace period avoids that transient flake without retry logic.
  await new Promise((resolve) => setTimeout(resolve, 150));

  return client;
}
