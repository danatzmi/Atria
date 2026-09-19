"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PLANS, type PlanTier } from "@/lib/plans";
import { createCheckoutSession } from "@/lib/payments/checkout-action";

// The pricing section as a chooser rather than three separate offers.
//
// Three CTAs made the visitor pick a button; one selection plus one
// Continue makes them pick a plan and then commit — the same shape as a
// real checkout, and it leaves a single obvious next step on the page.
// Shared between the marketing homepage and Settings. A signed-in user on
// the free plan needs to upgrade from inside the app, and linking them to
// the marketing page doesn't work — that route redirects signed-in
// visitors straight back to /projects.
export function PricingWidget({
  heading = "Simple plans",
  subheading = "Start free. Upgrade when your practice does.",
  // Settings renders this under its own "Plan" heading, and the free tier
  // isn't an upgrade — so that context turns both off.
  showHeading = true,
  includeFree = true,
  className = "mt-24 sm:mt-32",
}: {
  heading?: string;
  subheading?: string;
  showHeading?: boolean;
  includeFree?: boolean;
  className?: string;
} = {}) {
  const router = useRouter();
  const plans = includeFree ? PLANS : PLANS.filter((p) => p.tier !== "free");
  const [selected, setSelected] = useState<PlanTier>(plans[0].tier);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const plan = plans.find((p) => p.tier === selected) ?? plans[0];

  // Free needs no payment, so it stays a plain link to signup. Paid plans
  // go through the server action, which decides between checkout and
  // signup based on whether there's a session — the client can't know.
  function handleContinue() {
    // Narrowed through a local: a property access doesn't stay narrowed
    // across the closure below, so `tier` is what carries the proof that
    // this is a paid plan.
    const tier = plan.tier;
    if (tier === "free") return;
    setError(null);
    startTransition(async () => {
      const result = await createCheckoutSession(tier);
      if (result.status === "redirect") {
        // A provider-hosted page, so a full navigation rather than the
        // client router.
        window.location.href = result.url;
        return;
      }
      if (result.status === "signup_required") {
        router.push(`/signup?plan=${tier}`);
        return;
      }
      setError(result.message);
    });
  }

  return (
    <section id="pricing" className={`scroll-mt-8 ${className}`}>
      {showHeading && (
        <div className="text-center">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
            {heading}
          </h2>
          <p className="mt-3 text-base text-zinc-500">{subheading}</p>
        </div>
      )}

      {/* radiogroup, not a list of buttons: these are mutually exclusive
          choices, so arrow-key semantics and the announced selected state
          come for free. */}
      <div
        role="radiogroup"
        aria-label="Choose a plan"
        className={`grid gap-6 ${showHeading ? "mt-12" : "mt-4"} ${
          plans.length === 3 ? "md:grid-cols-3" : "sm:grid-cols-2"
        }`}
      >
        {plans.map((p) => {
          const isSelected = p.tier === selected;
          return (
            <button
              key={p.tier}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(p.tier)}
              // ring rather than a thicker border, so selecting a card
              // never changes its size and the grid can't shift as the
              // choice moves between columns.
              //
              // touch-manipulation is what makes these tappable on a phone.
              // With the default touch-action, iOS Safari holds the tap for
              // ~300ms waiting to see if it's a double-tap zoom, and drops
              // the click entirely if the finger drifts a pixel or two —
              // which on a card this tall reads as "nothing happens".
              // select-none stops a slightly-long press turning into a text
              // selection instead, and active: gives instant feedback so a
              // tap is visibly acknowledged before state updates.
              className={`flex touch-manipulation select-none flex-col rounded-xl border p-6 text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 active:scale-[0.99] ${
                isSelected
                  ? "border-zinc-900 shadow-md ring-2 ring-zinc-900"
                  : "cursor-pointer border-zinc-200 hover:border-zinc-300 hover:shadow-sm active:bg-zinc-50"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
                  {p.name}
                </h3>
                {p.featured && (
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white">
                    Popular
                  </span>
                )}
              </div>

              <p className="mt-5 flex items-baseline gap-1.5">
                <span className="text-3xl font-semibold tracking-tight text-zinc-900">
                  {p.price}
                </span>
                <span className="text-sm text-zinc-400">{p.cadence}</span>
              </p>
              <p className="mt-2 text-sm text-zinc-500">{p.line}</p>

              <ul className="mt-6 flex-1 space-y-2.5">
                {p.features.map((feature) => (
                  <li
                    key={feature}
                    className="flex items-start gap-2.5 text-sm text-zinc-600"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      aria-hidden
                      className={`mt-0.5 h-4 w-4 shrink-0 transition-colors ${
                        isSelected ? "text-zinc-900" : "text-zinc-300"
                      }`}
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.704 5.29a.75.75 0 0 1 .006 1.06l-7.25 7.5a.75.75 0 0 1-1.08 0l-3.75-3.875a.75.75 0 1 1 1.08-1.04l3.21 3.318 6.71-6.945a.75.75 0 0 1 1.074-.018Z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex flex-col items-center gap-3">
        {plan.tier === "free" ? (
          <Link
            href="/signup?plan=free"
            className="inline-flex touch-manipulation items-center justify-center rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700"
          >
            Continue with {plan.name}
          </Link>
        ) : (
          <button
            type="button"
            onClick={handleContinue}
            disabled={pending}
            className="inline-flex touch-manipulation items-center justify-center rounded-md bg-zinc-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700 disabled:opacity-60"
          >
            {pending ? "Starting checkout…" : `Continue with ${plan.name}`}
          </button>
        )}

        <p className="text-xs text-zinc-400">
          {plan.tier === "free" ? "No card required." : "Cancel any time."}
        </p>

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}
