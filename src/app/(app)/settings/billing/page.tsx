import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { planFor } from "@/lib/plans";
import { PricingWidget } from "@/components/pricing-widget";
import { ManageBillingButton } from "../manage-billing-button";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { count: projectCount }] = await Promise.all([
    supabase
      .from("users")
      .select(
        "plan, subscription_status, subscription_renews_at, subscription_ends_at, subscription_cancelled, card_brand, card_last_four"
      )
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id),
  ]);

  const plan = planFor(profile?.plan);
  const used = projectCount ?? 0;
  // Infinity would render as "3 / Infinity projects used".
  const limitLabel =
    plan.projectLimit === Infinity ? "unlimited" : String(plan.projectLimit);
  const atLimit = used >= plan.projectLimit;
  // The plan, not the customer id. A customer id is permanent — it is kept
  // after a subscription ends so a returning customer keeps one billing
  // identity — so testing it answered "have they ever paid?", which stays
  // true forever. The page needs "are they paying now?", and that is
  // exactly what the tier says: the webhook drops it to free the moment a
  // subscription expires.
  //
  // Read off the normalised plan rather than profile.plan directly, so an
  // unreadable row or an unrecognised value falls back to free and shows
  // the upgrade widget, rather than a Subscription panel with nothing in it.
  const hasSubscription = plan.tier !== "free";

  const cancelled = profile?.subscription_cancelled === true;
  const pastDue = profile?.subscription_status === "past_due";
  // A cancelled subscription is still running until it ends, so the date
  // that matters flips from "next charge" to "last day".
  const dateLabel = cancelled ? "Cancels on" : "Renews on";
  const dateValue = formatBillingDate(
    cancelled ? profile?.subscription_ends_at : profile?.subscription_renews_at
  );
  const card =
    profile?.card_brand && profile?.card_last_four
      ? `${capitalize(profile.card_brand)} ending in ${profile.card_last_four}`
      : null;

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Current plan
        </h2>

        <div className="mt-4 flex items-baseline justify-between gap-4">
          <p className="text-lg font-medium text-zinc-900">{plan.name}</p>
          <p className="text-sm text-zinc-500">
            {plan.price} {plan.cadence}
          </p>
        </div>

        <p className={`mt-3 text-sm ${atLimit ? "text-zinc-900" : "text-zinc-500"}`}>
          {used} of {limitLabel} {used === 1 ? "project" : "projects"} used
          {atLimit && plan.projectLimit !== Infinity && " — at your limit"}
        </p>

        {plan.projectLimit !== Infinity && (
          // Capped at 100% so being over the limit (possible after a
          // downgrade) doesn't overflow the track.
          <div
            className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-100"
            role="img"
            aria-label={`${used} of ${limitLabel} projects used`}
          >
            <div
              className={`h-full rounded-full ${atLimit ? "bg-zinc-900" : "bg-zinc-300"}`}
              style={{ width: `${Math.min(100, (used / plan.projectLimit) * 100)}%` }}
            />
          </div>
        )}
      </section>

      <section className="border-t border-zinc-100 pt-8">
        {hasSubscription ? (
          <>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Subscription
            </h2>

            {/* Above the details, not below: a failing payment is the one
                thing on this page someone must act on, and it explains why
                the button underneath says what it says. */}
            {pastDue && (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="text-sm font-medium text-amber-900">
                  Your last payment didn&rsquo;t go through
                </p>
                <p className="mt-1 text-sm text-amber-900/80">
                  Update your payment method below to keep your subscription
                  active.
                </p>
              </div>
            )}

            {(dateValue || card) && (
              <dl className="mt-4 space-y-2 text-sm">
                {dateValue && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">{dateLabel}</dt>
                    <dd className="text-zinc-900">{dateValue}</dd>
                  </div>
                )}
                {card && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-zinc-500">Payment method</dt>
                    <dd className="text-zinc-900">{card}</dd>
                  </div>
                )}
              </dl>
            )}

            <ManageBillingButton cancelled={cancelled} />
          </>
        ) : (
          <>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
              Upgrade
            </h2>
            <p className="mt-3 text-sm text-zinc-500">
              More projects and storage.
            </p>
            {/* The marketing page can't serve this — it redirects signed-in
                visitors straight back to /projects. */}
            <PricingWidget showHeading={false} includeFree={false} className="mt-4" />
          </>
        )}
      </section>
    </div>
  );
}

// The provider's brand strings arrive lowercase ("visa", "mastercard").
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

// Intl rather than toLocaleDateString with no arguments: this renders on
// the server, so an unqualified call would format in the server's locale,
// not the reader's. Pinning en-GB keeps it stable and unambiguous —
// "14 March 2026" cannot be misread the way 03/14 vs 14/03 can.
function formatBillingDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
