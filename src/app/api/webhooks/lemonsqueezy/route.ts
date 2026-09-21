import { createAdminClient } from "@/lib/supabase/admin";
import { PaymentConfigError } from "@/lib/payments";
import {
  parseSubscriptionEvent,
  verifyWebhookSignature,
} from "@/lib/payments/lemonsqueezy";

// Lemon Squeezy subscription webhook.
//
// The route stays deliberately thin: verify, normalise, write. Everything
// provider-specific — how requests are signed, where the variant id lives,
// which statuses mean "still paying" — is in the adapter, so swapping
// processors means a new adapter and a new route, not changes to the
// database logic below.

export async function POST(request: Request) {
  // The RAW body, before any parsing. Signature verification hashes the
  // exact bytes sent; re-serialising parsed JSON reorders keys and drops
  // whitespace, and the digest stops matching.
  const rawBody = await request.text();

  let verified: boolean;
  try {
    verified = verifyWebhookSignature(rawBody, request.headers.get("x-signature"));
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      // An unset secret is an operator problem. 500, not 401 — Lemon
      // Squeezy retries 5xx, so events aren't lost while it's being fixed.
      console.error("[atria] webhook not configured:", error.message);
      return new Response("Webhook not configured", { status: 500 });
    }
    throw error;
  }

  if (!verified) {
    // Anyone can POST here; without a valid signature this is an
    // unauthenticated request claiming someone paid.
    console.warn("[atria] rejected webhook with an invalid signature");
    return new Response("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response("Malformed JSON", { status: 400 });
  }

  const event = parseSubscriptionEvent(payload);
  if (!event) {
    // A signed event we don't act on (an order, a product we don't sell, a
    // payload with no user_id). 200 so it isn't retried forever.
    return new Response("Ignored", { status: 200 });
  }

  // Service role: there's no session on a webhook, and the billing columns
  // are revoked from `authenticated` precisely so only this path can write
  // them.
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("users")
    .update({
      plan: event.tier,
      stripe_customer_id: event.customerId,
      stripe_subscription_id: event.subscriptionId,
      // Written on every subscription event, so the row is a refreshed
      // snapshot of the provider's state rather than an accumulation of
      // whichever fields happened to be present. A null here means the
      // provider currently reports nothing, which is the truth worth
      // storing — carrying a stale renewal date forward would be worse.
      subscription_status: event.status,
      subscription_renews_at: event.renewsAt,
      subscription_ends_at: event.endsAt,
      subscription_cancelled: event.cancelled,
      card_brand: event.cardBrand,
      card_last_four: event.cardLastFour,
    })
    .eq("id", event.userId);

  if (error) {
    // 500 so Lemon Squeezy retries — a dropped event means someone paid
    // and didn't get their plan.
    console.error("[atria] webhook db update failed:", {
      userId: event.userId,
      tier: event.tier,
      message: error.message,
      code: error.code,
    });
    return new Response("Update failed", { status: 500 });
  }

  console.log("[atria] plan updated from webhook:", {
    userId: event.userId,
    tier: event.tier,
  });
  return new Response("OK", { status: 200 });
}
