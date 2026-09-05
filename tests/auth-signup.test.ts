// The signup branch that broke production — Supabase returning a created
// user with NO session because email confirmation is on — can't be
// reproduced against the local stack, where config.toml sets
// enable_confirmations = false. So this stubs the Supabase client and
// asserts the three outcomes directly.
//
// Unlike the other suites here, this one never touches the local Supabase
// stack; it's testing signUp/signIn's own decision logic, not the database.

import { beforeEach, describe, expect, it, vi } from "vitest";

const signUpMock = vi.fn();
const signInMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signUp: signUpMock, signInWithPassword: signInMock },
  }),
}));

const { signUp, signIn } = await import("../src/app/(auth)/actions");

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const CREDENTIALS = { name: "Dana", email: "a@b.com", password: "password123" };

// redirect() works by throwing; NEXT_REDIRECT is how we tell "went to
// /projects" apart from "returned a message to the form".
function isRedirect(e: unknown) {
  return (
    typeof e === "object" &&
    e !== null &&
    String((e as { digest?: string }).digest ?? "").startsWith("NEXT_REDIRECT")
  );
}

beforeEach(() => {
  signUpMock.mockReset();
  signInMock.mockReset();
});

describe("signUp", () => {
  it("surfaces Supabase's real error message instead of a generic one", async () => {
    signUpMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Password should be at least 6 characters" },
    });

    const result = await signUp({ error: null }, form(CREDENTIALS));

    expect(result.error).toBe("Password should be at least 6 characters");
    expect(result.notice).toBeUndefined();
  });

  it("reports a duplicate account with Supabase's own wording", async () => {
    signUpMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "User already registered" },
    });

    const result = await signUp({ error: null }, form(CREDENTIALS));

    expect(result.error).toBe("User already registered");
  });

  // The production bug: account created, no session. Must NOT redirect —
  // that's what bounced the user back to /login and looked like a failure.
  it("tells the user to confirm their email when no session is returned", async () => {
    signUpMock.mockResolvedValue({
      data: { session: null, user: { id: "u1" } },
      error: null,
    });

    const result = await signUp({ error: null }, form(CREDENTIALS));

    expect(result.error).toBeNull();
    expect(result.notice).toMatch(/confirmation link/i);
  });

  it("redirects into the app when signup returns a live session", async () => {
    signUpMock.mockResolvedValue({
      data: { session: { access_token: "t" }, user: { id: "u1" } },
      error: null,
    });

    await expect(signUp({ error: null }, form(CREDENTIALS))).rejects.toSatisfy(
      isRedirect
    );
  });
});

describe("signIn", () => {
  it("points an unconfirmed account at its confirmation email", async () => {
    signInMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Email not confirmed", code: "email_not_confirmed" },
    });

    const result = await signIn({ error: null }, form(CREDENTIALS));

    expect(result.error).toBeNull();
    expect(result.notice).toMatch(/confirm/i);
  });

  // Anything else stays vague on purpose — saying which field was wrong
  // would let someone probe for registered addresses.
  it("stays generic for bad credentials", async () => {
    signInMock.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "Invalid login credentials", code: "invalid_credentials" },
    });

    const result = await signIn({ error: null }, form(CREDENTIALS));

    expect(result.error).toBe("Incorrect email or password.");
    expect(result.notice).toBeUndefined();
  });
});
