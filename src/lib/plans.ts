// The single source of truth for subscription tiers: what each plan costs,
// what it promises on the marketing page, and the limits the server
// actually enforces. Marketing copy and enforcement drifting apart is how
// a customer ends up paying for ten projects and being allowed one, so the
// numbers a visitor reads and the numbers the backend checks are literally
// the same values.
//
// Tier ids match the `subscription_tier` enum in
// supabase/migrations/0007_subscriptions.sql.

export type PlanTier = "free" | "basic" | "pro";

export type Plan = {
  tier: PlanTier;
  name: string;
  price: string;
  cadence: string;
  line: string;
  // Enforced server-side. Infinity means no ceiling — it compares correctly
  // against any count without a special case at the call site.
  projectLimit: number;
  // The enforced ceiling, in bytes. storageLabel below is derived from it
  // rather than written out separately — this file exists because marketing
  // copy and enforcement drifting apart is how someone ends up paying for
  // 20 GB and being cut off at 1, and two independent literals is exactly
  // how that drift starts.
  storageBytes: number;
  storageLabel: string;
  features: string[];
  cta: string;
  featured: boolean;
};

const GB = 1024 * 1024 * 1024;
const gbLabel = (gb: number) => `${gb} GB`;

function projectsLabel(limit: number): string {
  if (limit === Infinity) return "Unlimited projects";
  return `${limit} project${limit === 1 ? "" : "s"}`;
}

// Written without `features`, which is derived below.
const PLAN_DEFS: Omit<Plan, "features">[] = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    line: "For a first project.",
    projectLimit: 1,
    storageBytes: 1 * GB,
    storageLabel: gbLabel(1),
    cta: "Get started",
    featured: false,
  },
  {
    tier: "basic",
    name: "Basic",
    price: "$9.99",
    cadence: "per month",
    line: "For a working practice.",
    projectLimit: 10,
    storageBytes: 20 * GB,
    storageLabel: gbLabel(20),
    cta: "Choose Basic",
    featured: true,
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$29.99",
    cadence: "per month",
    line: "For a studio.",
    projectLimit: Infinity,
    storageBytes: 100 * GB,
    storageLabel: gbLabel(100),
    cta: "Choose Pro",
    featured: false,
  },
];

// The feature list is exactly the two limits the server enforces, so it is
// generated from them rather than written out again. That is the same rule
// storageLabel follows, and it is now possible only because the list was
// stripped of everything that was not an enforced limit — "PDF export" had
// no number behind it to derive from.
//
// The drift this prevents is specific and easy to cause: raising
// projectLimit from 10 to 20 without noticing the string beneath it would
// leave the pricing page advertising 10 while the backend allowed 20.
export const PLANS: Plan[] = PLAN_DEFS.map((plan) => ({
  ...plan,
  features: [projectsLabel(plan.projectLimit), `${plan.storageLabel} of storage`],
}));

const BY_TIER = new Map(PLANS.map((p) => [p.tier, p]));

// Falls back to Free for an unknown or missing tier. A user row that somehow
// has no plan should get the most restrictive one, never the most generous.
export function planFor(tier: string | null | undefined): Plan {
  return BY_TIER.get((tier ?? "free") as PlanTier) ?? BY_TIER.get("free")!;
}

// The message shown when someone hits their ceiling. Names the plan and
// says what to do about it, rather than just refusing.
// Shown when a copy or an upload would take the workspace past its plan's
// ceiling. Deliberately says how much is free rather than only that it
// failed — "you need 1.2 GB and have 340 MB" is actionable, "not enough
// space" is not.
export function storageLimitMessage(plan: Plan): string {
  return `You do not have enough storage space to duplicate this project. Your ${plan.name} plan includes ${plan.storageLabel}. Please upgrade.`;
}

export function projectLimitMessage(plan: Plan): string {
  return `You've reached the ${plan.projectLimit}-project limit on the ${plan.name} plan. Upgrade to create more.`;
}
