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
      .select("plan, stripe_customer_id")
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
  const hasSubscription = !!profile?.stripe_customer_id;

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
            <ManageBillingButton />
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
