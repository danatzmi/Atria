"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/app/(marketing)/checkout-actions";
import type { PaidPlanTier } from "@/lib/payments";

export type AuthActionState = {
  error: string | null;
  // A non-error outcome the user still needs to see — currently only the
  // "confirm your email" step. Kept separate from `error` because that's
  // rendered in red: telling someone their account was created successfully
  // in failure styling is the same confusion this flow already had.
  notice?: string | null;
};

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    // An account that exists but hasn't been confirmed yet is a real,
    // fixable state — "Incorrect email or password" sends the user hunting
    // for a typo that isn't there, which is the other half of the signup
    // trap. Everything else stays deliberately vague: naming which field
    // was wrong would let someone probe for registered addresses.
    if (
      error.code === "email_not_confirmed" ||
      /email not confirmed/i.test(error.message)
    ) {
      return {
        error: null,
        notice:
          "This account still needs confirming. Check your email for the confirmation link.",
      };
    }
    return { error: "Incorrect email or password." };
  }

  redirect("/projects");
}

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "");
  // Carried through from the pricing widget's "Continue with Basic/Pro".
  // Anything other than a paid tier is treated as no intent at all — this
  // value decides whether someone is sent to a payment screen, so it is
  // validated rather than trusted.
  const rawPlan = String(formData.get("plan") ?? "");
  const paidPlan: PaidPlanTier | null =
    rawPlan === "basic" || rawPlan === "pro" ? rawPlan : null;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  });

  if (error) {
    // Supabase's own wording is the useful part here — "Password should be
    // at least 6 characters", "User already registered", "Unable to
    // validate email address". The generic message this replaces hid
    // exactly the information needed to fix the problem.
    return { error: error.message };
  }

  // Email confirmation is enabled on the project (Supabase's default): the
  // account now exists, but there's no session yet. Redirecting to
  // /projects here is what caused the silent bounce — AppLayout sees no
  // user and sends them straight back to /login, so a successful signup
  // looked like a failure.
  if (!data.session) {
    return {
      error: null,
      notice: paidPlan
        ? // No session means no authenticated user, so a checkout can't be
          // created yet. Saying "you'll be able to" rather than silently
          // dropping the plan, since the account itself is already made.
          "Account created. Check your email for a confirmation link — you can start your subscription once you're signed in."
        : "Account created. Check your email for a confirmation link, then sign in.",
    };
  }

  // A live session. If they picked a paid plan on the way in, send them
  // straight to checkout rather than into the app as a free user — that
  // drop was the broken step in the funnel.
  if (paidPlan) {
    const checkout = await createCheckoutSession(paidPlan);
    if (checkout.status === "redirect") {
      redirect(checkout.url);
    }
    // Checkout is unavailable (unconfigured, or the provider refused). The
    // account exists and they're signed in, so land them in the app rather
    // than stranding them on a dead form; they can upgrade from the
    // pricing page later.
    console.error(
      "[atria] signup checkout handoff failed:",
      checkout.status === "error" ? checkout.message : checkout.status
    );
  }

  redirect("/projects");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Home, not /login — signing out isn't a request to sign back in, and
  // the marketing page is a sensible place to land.
  redirect("/");
}
