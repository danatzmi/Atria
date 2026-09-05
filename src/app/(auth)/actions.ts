"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      notice:
        "Account created. Check your email for a confirmation link, then sign in.",
    };
  }

  // Confirmation is off, so signUp returned a live session — go straight in.
  redirect("/projects");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
