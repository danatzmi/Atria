// The adapter boundary. No network: these assert the contract the rest of
// the app depends on — that a missing key fails as a handled, typed error
// rather than a crash, and that plan names map to the right variant.
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { PaymentConfigError } from "../src/lib/payments/types";
import {
  lemonSqueezyProvider,
  parseSubscriptionEvent,
} from "../src/lib/payments/lemonsqueezy";

const KEYS = [
  "LEMON_SQUEEZY_API_KEY",
  "LEMON_SQUEEZY_STORE_ID",
  "NEXT_PUBLIC_LS_BASIC_VARIANT_ID",
  "NEXT_PUBLIC_LS_PRO_VARIANT_ID",
];
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
});
afterEach(() => {
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe("lemon squeezy adapter", () => {
  it("identifies itself without callers importing anything provider-specific", () => {
    expect(lemonSqueezyProvider.name).toBe("Lemon Squeezy");
  });

  // The whole point of reading env lazily: an unset key must not crash an
  // unrelated page at import time.
  it("throws a typed config error when the API key is missing", async () => {
    delete process.env.LEMON_SQUEEZY_API_KEY;
    await expect(
      lemonSqueezyProvider.createCheckout("basic", "user-1")
    ).rejects.toBeInstanceOf(PaymentConfigError);
  });

  it("throws a typed config error when the store id is missing", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    delete process.env.LEMON_SQUEEZY_STORE_ID;
    await expect(
      lemonSqueezyProvider.createCheckout("basic", "user-1")
    ).rejects.toBeInstanceOf(PaymentConfigError);
  });

  it("names the missing variable so an operator can fix it", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "store-1";
    delete process.env.NEXT_PUBLIC_LS_PRO_VARIANT_ID;
    await expect(
      lemonSqueezyProvider.createCheckout("pro", "user-1")
    ).rejects.toThrow(/NEXT_PUBLIC_LS_PRO_VARIANT_ID/);
  });

  it("maps each plan to its own variant id", async () => {
    process.env.LEMON_SQUEEZY_API_KEY = "test-key";
    process.env.LEMON_SQUEEZY_STORE_ID = "store-1";
    delete process.env.NEXT_PUBLIC_LS_BASIC_VARIANT_ID;
    process.env.NEXT_PUBLIC_LS_PRO_VARIANT_ID = "pro-variant";
    // basic is unset, pro is set — so only basic should complain, proving
    // the two tiers don't share a variable.
    await expect(
      lemonSqueezyProvider.createCheckout("basic", "user-1")
    ).rejects.toThrow(/NEXT_PUBLIC_LS_BASIC_VARIANT_ID/);
  });
});

// The billing page reads six display-only fields off the user row, all of
// them written from a webhook payload the app does not control. These
// assert the mapping and — more importantly — that a payload missing any of
// them still yields a usable event rather than throwing, since a throw here
// becomes a 500 and Lemon Squeezy retries the plan change forever.
describe("parseSubscriptionEvent", () => {
  const payload = (attrs: Record<string, unknown>) => ({
    meta: { event_name: "subscription_updated", custom_data: { user_id: "user-1" } },
    data: { id: "sub-99", attributes: { variant_id: "pro-variant", customer_id: 5150, ...attrs } },
  });

  beforeEach(() => {
    process.env.NEXT_PUBLIC_LS_PRO_VARIANT_ID = "pro-variant";
  });

  it("maps the subscription detail the billing page renders", () => {
    const event = parseSubscriptionEvent(
      payload({
        status: "active",
        cancelled: false,
        renews_at: "2026-03-14T09:00:00.000000Z",
        ends_at: null,
        card_brand: "visa",
        card_last_four: "4242",
      })
    );

    expect(event).toMatchObject({
      userId: "user-1",
      tier: "pro",
      customerId: "5150",
      subscriptionId: "sub-99",
      status: "active",
      renewsAt: "2026-03-14T09:00:00.000000Z",
      endsAt: null,
      cancelled: false,
      cardBrand: "visa",
      cardLastFour: "4242",
    });
  });

  it("survives a payload with none of the optional fields", () => {
    const event = parseSubscriptionEvent(payload({ status: "active" }));

    expect(event).toMatchObject({
      tier: "pro",
      renewsAt: null,
      endsAt: null,
      cancelled: false,
      cardBrand: null,
      cardLastFour: null,
    });
  });

  it("treats empty strings as absent, so the UI never prints a blank card", () => {
    const event = parseSubscriptionEvent(
      payload({ status: "active", card_brand: "", card_last_four: "", renews_at: "" })
    );

    expect(event?.cardBrand).toBeNull();
    expect(event?.cardLastFour).toBeNull();
    expect(event?.renewsAt).toBeNull();
  });

  // The distinction the whole `subscription_cancelled` column exists for:
  // opted out, but still paid up until ends_at.
  it("reports cancelled while the subscription is still active", () => {
    const event = parseSubscriptionEvent(
      payload({ status: "active", cancelled: true, ends_at: "2026-04-01T09:00:00Z" })
    );

    expect(event?.cancelled).toBe(true);
    expect(event?.tier).toBe("pro");
    expect(event?.endsAt).toBe("2026-04-01T09:00:00Z");
  });

  it("drops to the free plan once the subscription has actually expired", () => {
    const event = parseSubscriptionEvent(payload({ status: "expired", cancelled: true }));
    expect(event?.tier).toBe("free");
  });
});
