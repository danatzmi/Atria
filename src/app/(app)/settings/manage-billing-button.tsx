"use client";

import { useState, useTransition } from "react";
import { openBillingPortal } from "./actions";

// Sends the customer to the payment provider's hosted portal. The URL is
// generated per click and short-lived, so it is fetched on demand rather
// than rendered into the page.
export function ManageBillingButton({
  // A cancelled-but-still-running subscription can be resumed from the
  // same portal, so the destination is identical — only the label changes.
  // "Manage subscription" is not wrong there, but it hides the one action
  // someone in that state is most likely looking for.
  cancelled = false,
}: {
  cancelled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await openBillingPortal();
      if (result.status === "redirect") {
        // A provider-hosted page, so a full navigation.
        window.location.href = result.url;
        return;
      }
      setError(result.message);
    });
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="touch-manipulation rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-60"
      >
        {pending ? "Opening…" : cancelled ? "Resume subscription" : "Manage subscription"}
      </button>
      <p className="mt-2 text-xs text-zinc-400">
        {cancelled
          ? "Restart your plan, or update your card."
          : "Change plan, update your card, or cancel."}
      </p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
