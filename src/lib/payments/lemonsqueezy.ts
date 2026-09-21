import { createHmac, timingSafeEqual } from "node:crypto";
import {
  createCheckout as lsCreateCheckout,
  getSubscription,
  lemonSqueezySetup,
} from "@lemonsqueezy/lemonsqueezy.js";
import type { PlanTier } from "@/lib/plans";
import {
  PaymentConfigError,
  PaymentProviderError,
  type CheckoutOptions,
  type PaidPlanTier,
  type PaymentProvider,
  type SubscriptionEvent,
} from "./types";

// Lemon Squeezy's implementation of PaymentProvider.
//
// This file is the ONLY place in the codebase that knows what a "variant"
// is. The mapping from Atria's own plan names to Lemon Squeezy variant ids
// lives here and nowhere else, so the UI and the server action both stay in
// Atria's vocabulary.

// Read lazily, inside the call, rather than at module load. A missing key
// should surface as a handled error when someone tries to pay — not as a
// crash at import time that takes down every page that transitively
// imports this module, including ones with nothing to do with billing.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new PaymentConfigError(
      `${name} is not set — Lemon Squeezy checkout is unavailable.`
    );
  }
  return value;
}

// The plan → variant mapping. The env vars carry the NEXT_PUBLIC_ prefix
// because that's how they were provisioned, but nothing client-side reads
// them: they're resolved here, on the server, and only a checkout URL ever
// reaches the browser.
function variantIdFor(plan: PaidPlanTier): string {
  switch (plan) {
    case "basic":
      return requireEnv("NEXT_PUBLIC_LS_BASIC_VARIANT_ID");
    case "pro":
      return requireEnv("NEXT_PUBLIC_LS_PRO_VARIANT_ID");
  }
}

export const lemonSqueezyProvider: PaymentProvider = {
  name: "Lemon Squeezy",

  async createCheckout(
    plan: PaidPlanTier,
    userId: string,
    options: CheckoutOptions = {}
  ): Promise<string> {
    const apiKey = requireEnv("LEMON_SQUEEZY_API_KEY");
    const storeId = requireEnv("LEMON_SQUEEZY_STORE_ID");
    const variantId = variantIdFor(plan);

    lemonSqueezySetup({
      apiKey,
      // The SDK reports failures through its return value; this keeps its
      // internal errors out of the server log as unhandled noise.
      onError: () => {},
    });

    const { data, error } = await lsCreateCheckout(storeId, variantId, {
      checkoutData: {
        email: options.email,
        // How the webhook identifies who paid. Lemon Squeezy echoes custom
        // data back on every subscription event, and it is the only link
        // between a payment and an Atria user — a customer's billing email
        // need not match the one they signed up with.
        custom: { user_id: userId },
      },
      productOptions: {
        redirectUrl: options.redirectUrl,
        // The customer has already chosen a plan in Atria's own UI;
        // showing the store's product list again would invite them to
        // change it outside anything we can observe.
        enabledVariants: [Number(variantId)],
      },
      // Test-mode checkouts are driven by the key, not this flag, so it is
      // deliberately left to the account's own configuration.
    });

    if (error) {
      throw new PaymentProviderError(
        `Lemon Squeezy rejected the checkout request: ${error.message}`
      );
    }

    const url = data?.data?.attributes?.url;
    if (!url) {
      throw new PaymentProviderError(
        "Lemon Squeezy returned no checkout URL."
      );
    }
    return url;
  },

  // Read from the SUBSCRIPTION, not the customer.
  //
  // Both objects expose `urls.customer_portal`, and the customer's one is
  // the wrong link: it resolves to the generic app.lemonsqueezy.com
  // my-orders page, which asks the customer to prove who they are by
  // email before showing them anything — and misbehaves outright for a
  // user who also happens to be a merchant on the platform.
  //
  // The subscription's is a pre-signed magic link on the store's own
  // domain that opens straight into the portal with no login step. The
  // SDK's own types reflect the difference: it is `string | null` on a
  // customer and plain `string` on a subscription.
  //
  // Both are valid for 24 hours, so this is generated per click and never
  // stored — see ManageBillingButton, which fetches it on demand.
  async createBillingPortalUrl(
    _customerId: string,
    subscriptionId: string | null
  ): Promise<string> {
    if (!subscriptionId) {
      throw new PaymentProviderError(
        "This account has no Lemon Squeezy subscription to manage."
      );
    }

    const apiKey = requireEnv("LEMON_SQUEEZY_API_KEY");
    lemonSqueezySetup({ apiKey, onError: () => {} });

    const { data, error } = await getSubscription(subscriptionId);
    if (error) {
      throw new PaymentProviderError(
        `Lemon Squeezy could not load the subscription: ${error.message}`
      );
    }

    const url = data?.data?.attributes?.urls?.customer_portal;
    if (!url) {
      throw new PaymentProviderError(
        "Lemon Squeezy returned no customer portal URL for this subscription."
      );
    }
    return url;
  },
};

// ---------------------------------------------------------------------------
// Webhooks
//
// Also provider-specific, so it lives here rather than in the route: the
// route should know it received "a subscription event", not how Lemon
// Squeezy signs requests or where it hides the variant id.
// ---------------------------------------------------------------------------

// Reverse of variantIdFor. Returns null for a variant this app doesn't
// sell — a store can contain products unrelated to these plans, and an
// unrecognised one must not silently upgrade anybody.
function planForVariantId(variantId: string | number): PlanTier | null {
  const id = String(variantId);
  if (id === process.env.NEXT_PUBLIC_LS_BASIC_VARIANT_ID) return "basic";
  if (id === process.env.NEXT_PUBLIC_LS_PRO_VARIANT_ID) return "pro";
  return null;
}

// Verifies the X-Signature header against the raw request body.
//
// Must be given the EXACT bytes received — re-serialising parsed JSON
// changes key order and whitespace, and the digest no longer matches.
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    throw new PaymentConfigError(
      "LEMON_SQUEEZY_WEBHOOK_SECRET is not set — webhooks cannot be verified."
    );
  }
  if (!signature) return false;

  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  // Length must match before timingSafeEqual, which throws otherwise — and
  // a plain === comparison here would leak the digest a byte at a time.
  if (received.length !== expected.length) return false;
  return timingSafeEqual(received, expected);
}

// Subscription states that mean "no longer paying". Lemon Squeezy keeps
// sending subscription_updated as a subscription winds down, so the status
// — not the event name — is what decides whether access continues.
const INACTIVE_STATUSES = new Set([
  "expired",
  "unpaid",
  "cancelled",
]);

// Normalises a Lemon Squeezy payload into a SubscriptionEvent, or returns
// null when the payload isn't one we act on.
export function parseSubscriptionEvent(
  payload: unknown
): SubscriptionEvent | null {
  const body = payload as {
    meta?: { event_name?: string; custom_data?: { user_id?: string } };
    data?: {
      id?: string;
      attributes?: {
        variant_id?: number | string;
        customer_id?: number | string;
        status?: string;
        cancelled?: boolean;
        renews_at?: string | null;
        ends_at?: string | null;
        card_brand?: string | null;
        card_last_four?: string | null;
      };
    };
  };

  const event = body?.meta?.event_name ?? "";
  if (!event.startsWith("subscription_")) return null;
  // Payment-level events (subscription_payment_success and friends) carry a
  // different shape and would be redundant — the subscription events
  // already describe the resulting state.
  if (event.startsWith("subscription_payment")) return null;

  const userId = body?.meta?.custom_data?.user_id;
  if (!userId) return null;

  const attrs = body?.data?.attributes ?? {};
  const status = String(attrs.status ?? "");

  // An ended subscription drops the account to free. `cancelled` is not
  // included here on purpose: Lemon Squeezy marks a subscription cancelled
  // the moment someone opts out, but they keep access until the period
  // ends, at which point the status becomes "expired".
  const ended = INACTIVE_STATUSES.has(status) && status !== "cancelled";
  const tier = ended ? "free" : planForVariantId(attrs.variant_id ?? "");
  if (tier === null) return null;

  // Read defensively rather than trusting the payload's shape: this is
  // parsing a third party's JSON, and a missing field should cost a line on
  // the billing page, not a 500 that makes Lemon Squeezy retry forever.
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);

  return {
    userId,
    tier,
    customerId: attrs.customer_id != null ? String(attrs.customer_id) : null,
    subscriptionId: body?.data?.id != null ? String(body.data.id) : null,
    status: status || null,
    renewsAt: str(attrs.renews_at),
    endsAt: str(attrs.ends_at),
    cancelled: attrs.cancelled === true,
    cardBrand: str(attrs.card_brand),
    cardLastFour: str(attrs.card_last_four),
  };
}
