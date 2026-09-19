"use client";

import Link from "next/link";
import { Dropdown } from "@/components/dropdown";
import { GearIcon, SignOutIcon } from "./projects/[id]/folder/item-icon";
import { signOut } from "../(auth)/actions";

// The account menu behind an avatar, replacing two loose text links in the
// header. The avatar also gives the header somewhere to grow — a real
// photo, an org switcher — without adding more links to the bar.
export function UserMenu({ name, email }: { name: string | null; email: string | null }) {
  // Initial from the name, falling back to the email; "?" only if both are
  // somehow empty, so the circle is never blank.
  const source = (name?.trim() || email?.trim() || "").replace(/^[^a-z0-9]+/i, "");
  const initial = source.charAt(0).toUpperCase() || "?";
  const label = name?.trim() || email || "Account";

  const item =
    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50";

  return (
    <Dropdown
      label="Account menu"
      align="end"
      menuClassName="w-56"
      contentWidth={224}
      trigger={(props) => (
        <button
          {...props}
          type="button"
          // A circle of text, so it needs an accessible name of its own.
          aria-label={`Account menu for ${label}`}
          className="flex h-8 w-8 touch-manipulation items-center justify-center rounded-full bg-zinc-700 text-sm font-medium text-white transition-colors hover:bg-zinc-600"
        >
          {initial}
        </button>
      )}
    >
      {(close) => (
        <>
          {/* Whose account this is — the avatar alone doesn't say. */}
          <div className="border-b border-zinc-100 px-3 pb-2 pt-1">
            {name && (
              <p className="truncate text-sm font-medium text-zinc-900">{name}</p>
            )}
            <p className="truncate text-xs text-zinc-500">{email}</p>
          </div>

          {/* One entry point. /settings redirects to /settings/profile,
              and the settings page has its own section nav — duplicating
              those sections here would mean two places to keep in step. */}
          <Link href="/settings" onClick={close} className={item}>
            <GearIcon className="h-4 w-4 shrink-0 text-zinc-400" />
            Settings
          </Link>

          <form action={signOut}>
            <button type="submit" className={item}>
              <SignOutIcon className="h-4 w-4 shrink-0 text-zinc-400" />
              Sign out
            </button>
          </form>
        </>
      )}
    </Dropdown>
  );
}
