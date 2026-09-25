"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { browserOrigin } from "@/lib/browser-origin";
import { createCheckoutSession } from "@/lib/payments/checkout-action";
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

// ---------------------------------------------------------------------------
// Password recovery
// ---------------------------------------------------------------------------

export async function requestPasswordReset(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address." };

  // Built from the request's own origin rather than a configured constant,
  // so the link works from localhost, a LAN IP during phone testing, and
  // production without a per-environment variable to keep in sync.
  //
  // The same helper the callback uses, deliberately: if these two ever
  // disagreed the email would point at one origin and the redirect land on
  // another, which costs the session silently.
  //
  // The result must still be on Supabase's redirect allow-list (Auth → URL
  // Configuration), or Supabase quietly substitutes the Site URL.
  const origin = await browserOrigin();

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/api/auth/callback?next=/reset-password`,
  });

  if (error) {
    console.error("[atria] password reset request failed:", error.message);
  }

  // The same answer either way, deliberately — including when Supabase
  // errored. Saying "no account with that email" turns this form into a
  // membership oracle: anyone could test an address and learn whether that
  // person uses Atria. The cost is that a typo looks like success, which
  // the wording below softens by naming the address back to them.
  return {
    error: null,
    notice: `If an account exists for ${email}, a reset link is on its way. Check your inbox — and your spam folder.`,
  };
}

export async function updatePassword(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const password = String(formData.get("password") ?? "");
  const confirmation = String(formData.get("confirm_password") ?? "");

  if (password.length < 6) {
    return { error: "Use at least 6 characters." };
  }
  if (password !== confirmation) {
    return { error: "Those passwords don't match." };
  }

  const supabase = await createClient();

  // The token travels in the form, not the URL bar, and is spent HERE — on
  // submit — rather than when the page was opened.
  //
  // That ordering is the whole point. A recovery token is single-use, and
  // anything that follows the link consumes it: corporate mail scanners,
  // antivirus link-checkers, and preview fetchers all issue a GET the
  // moment the mail arrives. With the old flow they burned the token before
  // the human ever clicked, and the user got "otp_expired" on a link that
  // was seconds old. A scanner GETting this page now just renders a form.
  const tokenHash = String(formData.get("token_hash") ?? "");

  if (tokenHash) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: "recovery",
    });
    if (verifyError) {
      // Noted, NOT returned. A spent token is the expected state on a
      // second submit: the form re-posts the same token_hash, and the first
      // attempt already exchanged it for a session. That happens whenever
      // the first try was rejected for a reason that has nothing to do with
      // the link — "New password should be different from the old
      // password", most often. Failing here told someone who had simply
      // mistyped that their link had expired, and left them with no way
      // forward but a fresh email. The session check below is what actually
      // decides, and it is the honest question: is this person
      // authenticated right now?
      console.warn("[atria] recovery verifyOtp failed:", verifyError.message);
    }
  }

  // The real gate. Either verifyOtp just established a session, or one was
  // already in place — an earlier submit seconds ago, a user who is already
  // signed in, or a link from the older flow that the callback route
  // exchanged. Proceeding on an existing session grants nothing extra:
  // updateUser only ever acts on whoever the session belongs to, so a
  // forged token cannot reach another account.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error:
        "This reset link has expired or was already used. Request a new one from the sign-in page.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    // Supabase's wording is the useful part — "New password should be
    // different from the old password" is exactly what the person needs.
    return { error: error.message };
  }

  redirect("/projects");
}
