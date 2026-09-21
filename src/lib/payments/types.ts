import type { PlanTier } from "@/lib/plans";

// Only paid tiers can be checked out. Free is a plan but never a purchase,
// and encoding that in the type means no adapter has to defend against it.
export type PaidPlanTier = Exclude<PlanTier, "free">;

export type CheckoutOptions = {
  // Prefills the provider's form. Optional — a provider that can't use it
  // ignores it rather than failing.
  email?: string;
  // Where the provider returns the customer after a successful payment.
  redirectUrl?: string;
};

// The contract every payment provider implements.
//
// Deliberately says nothing about variants, prices, sessions or webhooks —
// those are provider vocabulary. Callers pass a plan and a user, and get
// back a URL to send the browser to. Swapping Lemon Squeezy for Stripe or
// Paddle means writing one new file that satisfies this interface and
// changing the single line in ./index.ts that picks the active provider;
// no UI or business logic moves.
export interface PaymentProvider {
  // For logs and error messages, so a failure names the provider that
  // produced it without the caller importing anything provider-specific.
  readonly name: string;

  // Returns a hosted checkout URL. Throws PaymentConfigError when the
  // provider isn't configured, and PaymentProviderError when the provider
  // rejects the request.
  createCheckout(
    plan: PaidPlanTier,
    userId: string,
    options?: CheckoutOptions
  ): Promise<string>;

  // A URL where the customer manages their own subscription — changing
  // card, upgrading, downgrading, cancelling, downloading invoices.
  //
  // Deliberately the provider's own hosted portal rather than screens in
  // Atria: prorating, dunning, tax and invoice PDFs are a large, regulated
  // surface that every processor already solves, and rebuilding it would
  // be the single biggest source of billing bugs in the app.
  //
  // Both ids are passed because providers disagree about which one owns
  // the portal. Stripe's portal session is created from the customer;
  // Lemon Squeezy's usable portal link hangs off the subscription. An
  // adapter uses whichever it needs and ignores the other, which is
  // cheaper than making every caller know the difference.
  //
  // `customerId` is the provider's own id, stored on the user when their
  // first subscription webhook arrives. `subscriptionId` is null for a
  // user who has never had a subscription.
  createBillingPortalUrl(
    customerId: string,
    subscriptionId: string | null
  ): Promise<string>;
}

// A subscription event, normalised out of whatever shape the provider
// sends. The webhook route works with this and never sees provider JSON.
export type SubscriptionEvent = {
  // Which Atria user this is about, from the custom data attached at
  // checkout.
  userId: string;
  // The tier they should end up on. "free" means the subscription ended,
  // so the account drops back to the free plan.
  tier: PlanTier;
  customerId: string | null;
  subscriptionId: string | null;

  // Everything below is for display only — never for deciding what a user
  // may do. `tier` above is the single field access control reads, so a
  // provider that stops sending card details degrades the billing page
  // rather than locking anyone out.
  //
  // All nullable: a provider may omit any of them, and an event that
  // arrives without card details should still record the plan change.
  status: string | null;
  renewsAt: string | null;
  endsAt: string | null;
  // Not the same as status === "cancelled". Lemon Squeezy sets this the
  // moment someone opts out, while the subscription stays active until the
  // period ends — so this is true during a window when the user still has
  // full access, and the UI must say "cancels on…" rather than "cancelled".
  cancelled: boolean;
  cardBrand: string | null;
  cardLastFour: string | null;
};

// Missing or malformed configuration — an operator problem (an unset env
// var), not something the customer did. Kept separate so the UI can say
// "payments aren't available right now" rather than blaming the user.
export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}

// The provider accepted the request and refused it, or was unreachable.
export class PaymentProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentProviderError";
  }
}
