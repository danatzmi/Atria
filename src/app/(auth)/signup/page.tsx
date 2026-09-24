"use client";

import { Suspense, useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signUp, type AuthActionState } from "../actions";
import { BackLink } from "../back-link";

const initialState: AuthActionState = { error: null };

// useSearchParams opts the subtree into client rendering, so it lives in
// its own component behind a Suspense boundary — otherwise the whole
// signup page would be excluded from static prerendering for the sake of
// one hidden field.
function PlanField() {
  const plan = useSearchParams().get("plan");
  if (plan !== "basic" && plan !== "pro" && plan !== "free") return null;
  return <input type="hidden" name="plan" value={plan} />;
}

// Shown so the choice made on the pricing page is visibly carried over —
// signing up "for Basic" and landing somewhere generic is disorienting.
function PlanNotice() {
  const plan = useSearchParams().get("plan");
  if (plan !== "basic" && plan !== "pro") return null;
  const label = plan === "basic" ? "Basic" : "Pro";
  return (
    <p className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
      Creating your account for the <span className="font-medium text-zinc-900">{label}</span> plan
      — you&rsquo;ll go to checkout next.
    </p>
  );
}

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signUp, initialState);

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
          Create your account to start organizing projects.
        </p>

        <Suspense fallback={null}>
          <PlanNotice />
        </Suspense>

        <form action={formAction} className="mt-8 space-y-4">
          <Suspense fallback={null}>
            <PlanField />
          </Suspense>

          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-700"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              autoComplete="name"
              className="mt-1 block w-full rounded-md border border-zinc-300 px-3 py-2 text-base sm:text-sm shadow-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500"
            />
          </div>

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
              minLength={6}
              autoComplete="new-password"
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
            {pending ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-900">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
