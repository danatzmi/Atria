"use client";

import { useSyncExternalStore } from "react";

// Shows why an email link failed.
//
// Supabase reports verification failures in the URL's HASH
// (#error=access_denied&error_code=otp_expired&…). A hash is never sent to
// the server, so the callback route cannot see it and can only report that
// no `code` arrived — which is true and useless. Without this the user is
// bounced with an opaque ?error=missing_code and no idea what to do next.
const MESSAGES: Record<string, string> = {
  otp_expired:
    "That reset link has expired or was already used. Links can only be opened once — request a new one below.",
  access_denied: "That link is no longer valid. Request a new one below.",
  missing_code:
    "That reset link has expired or was already used. Request a new one below.",
  link_expired:
    "That reset link has expired or was already used. Request a new one below.",
};

// useSyncExternalStore rather than useEffect + setState: the URL is an
// external value that is only readable on the client, and this is the API
// built for exactly that. It also keeps the server snapshot explicitly
// null, so the markup matches and there is no hydration mismatch.
//
// The result is memoised against the href because getSnapshot must return
// a stable reference — recomputing a string on every call would spin React.
let cache: { href: string; message: string | null } | null = null;

function getSnapshot(): string | null {
  const href = window.location.href;
  if (cache?.href === href) return cache.message;

  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const key =
    hash.get("error_code") ?? hash.get("error") ?? query.get("error") ?? null;

  let message: string | null = null;
  if (key) {
    message =
      MESSAGES[key] ??
      hash.get("error_description")?.replace(/\+/g, " ") ??
      "That link could not be used. Request a new one below.";
  }

  cache = { href, message };
  return message;
}

// The URL does not change under us on this page, so there is nothing to
// subscribe to.
const subscribe = () => () => {};

export function AuthLinkError() {
  const message = useSyncExternalStore(subscribe, getSnapshot, () => null);
  if (!message) return null;

  return (
    <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
      <p className="text-sm text-amber-900">{message}</p>
    </div>
  );
}
