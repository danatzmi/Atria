"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn, type AuthActionState } from "../actions";
import { BackLink } from "../back-link";

const initialState: AuthActionState = { error: null };

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <div className="relative flex flex-1 items-center justify-center px-6 py-16">
      {/* Top-left corner of the page, not inside the form — mirrors where a
          browser's Back button would sit. Inset a little further on wider
          screens so it lines up with the page's own padding. */}
      <div className="absolute left-2 top-4 sm:left-4 sm:top-6">
        <BackLink />
      </div>

      <div className="w-full max-w-sm">
        {/* The wordmark links home too; the corner Back above is what a
            standalone PWA needs, where there's no browser chrome at all. */}
        <Link
          href="/"
          className="inline-block text-2xl font-semibold tracking-tight text-zinc-900 transition-colors hover:text-zinc-600"
        >
          Atria
        </Link>
        <p className="mt-1 text-sm text-zinc-500">
          Sign in to your projects.
        </p>

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
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-zinc-700"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>

          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}

          {state.notice && (
            <p className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              {state.notice}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-500">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-zinc-900">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
