import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { planFor } from "@/lib/plans";
import { ChevronLeftIcon } from "../projects/[id]/folder/item-icon";
import { NameForm } from "./name-form";
import { ManageBillingButton } from "./manage-billing-button";
import { DeleteAccountDialog } from "./delete-account-dialog";
import { PricingWidget } from "@/components/pricing-widget";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { count: projectCount }] = await Promise.all([
    supabase
      .from("users")
      .select("name, email, plan, stripe_customer_id")
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
  const limitLabel = plan.projectLimit === Infinity ? "unlimited" : String(plan.projectLimit);
  const atLimit = used >= plan.projectLimit;
  const hasSubscription = !!profile?.stripe_customer_id;

  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-6 py-10">
      <Link
        href="/projects"
        className="group -ml-1 inline-flex items-center gap-0.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-zinc-900"
      >
        <ChevronLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        Projects
      </Link>

      <h1 className="mt-6 text-xl font-semibold tracking-tight text-zinc-900">
        Settings
      </h1>

      <section className="mt-10">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Profile
        </h2>

        <div className="mt-4 space-y-5">
          <div>
            <p className="text-sm font-medium text-zinc-700">Name</p>
            <NameForm initialName={profile?.name ?? ""} />
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-700">Email</p>
            <p className="mt-1 text-sm text-zinc-500">{profile?.email ?? user.email}</p>
            {/* Changing an email means re-verifying it and handling the
                window where two addresses are live — deliberately out of
                scope, so it's shown rather than edited. */}
            <p className="mt-1 text-xs text-zinc-400">
              Get in touch if you need to change this.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-12 border-t border-zinc-100 pt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Plan
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
          // A plain proportion bar. Capped at 100% so being over the limit
          // (possible if a plan is downgraded) doesn't overflow the track.
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

        {hasSubscription ? (
          <ManageBillingButton />
        ) : (
          // No subscription to manage, so offer the upgrade itself rather
          // than a link to the marketing page — that route bounces
          // signed-in visitors straight back to /projects.
          <div className="mt-6">
            <p className="text-sm text-zinc-500">Upgrade for more projects and storage.</p>
            <PricingWidget
              showHeading={false}
              includeFree={false}
              className="mt-4"
            />
          </div>
        )}
      </section>

      <section className="mt-12 border-t border-zinc-100 pt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-red-500">
          Danger zone
        </h2>
        <p className="mt-3 text-sm text-zinc-600">
          Deleting your account removes every project, file and note you have.
          This can&rsquo;t be undone.
        </p>
        <div className="mt-4">
          <DeleteAccountDialog />
        </div>
      </section>
    </div>
  );
}
