"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { updatePassword, type AuthActionState } from "../actions";
import { BackLink } from "../back-link";

const initialState: AuthActionState = { error: null };

// Carries the recovery token from the URL into the form, so it is spent on
// submit rather than on page load. useSearchParams opts its subtree into
// client rendering, so it sits behind its own Suspense boundary — the same
// arrangement the signup page uses for the plan parameter.
function TokenField() {
  const tokenHash = useSearchParams().get("token_hash");
  if (!tokenHash) return null;
  return <input type="hidden" name="token_hash" value={tokenHash} />;
}

// Reached straight from the recovery email. The link carries a token_hash
// which nothing verifies until the form is submitted — see updatePassword
// for why that ordering matters. A visit with no token still works for
// someone who is already signed in, and for links from the older flow that
// /api/auth/callback exchanged into a session.
export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(
    updatePassword,
    initialState
  );

  return (
    <div className="relative flex flex-1 items-center justify-center px-6 py-16">
      <div className="absolute left-2 top-4 sm:left-4 sm:top-6">
        <BackLink />
      </div>

      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="inline-block text-2xl font-semibold tracking-tight text-zinc-900 transition-colors hover:text-zinc-600"
        >
          Atria
        </Link>
        <p className="mt-1 text-sm text-zinc-500">Choose a new password.</p>

        <form action={formAction} className="mt-8 space-y-4">
          <Suspense fallback={null}>
            <TokenField />
          </Suspense>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700"
            >
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              autoFocus
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          <div>
            <label
              htmlFor="confirm_password"
              className="block text-sm font-medium text-zinc-700"
            >
              Confirm new password
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            {pending ? "Saving…" : "Set new password"}
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-500">
          <Link href="/login" className="font-medium text-zinc-900">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
