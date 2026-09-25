"use client";

import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordReset, type AuthActionState } from "../actions";
import { BackLink } from "../back-link";

const initialState: AuthActionState = { error: null };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState
  );

  // Once the mail is away the form has nothing left to do, and leaving it
  // on screen invites a second and third submission while the first is
  // still in flight.
  const sent = !!state.notice;

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
        <p className="mt-1 text-sm text-zinc-500">
          {sent
            ? "Check your email."
            : "We'll email you a link to set a new password."}
        </p>

        {sent ? (
          <>
            <p className="mt-8 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-700">
              {state.notice}
            </p>
            <p className="mt-6 text-sm text-zinc-500">
              <Link href="/login" className="font-medium text-zinc-900">
                Back to sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <form action={formAction} className="mt-8 space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
                />
              </div>

              {state.error && (
                <p className="text-sm text-red-600">{state.error}</p>
              )}

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
              >
                {pending ? "Sending…" : "Send reset link"}
              </button>
            </form>

            <p className="mt-6 text-sm text-zinc-500">
              Remembered it?{" "}
              <Link href="/login" className="font-medium text-zinc-900">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
