// The lock on the webhook door.
//
// /api/webhooks/lemonsqueezy takes an unauthenticated POST and, if it
// believes it, writes a plan to a user row with the service role. The only
// thing between a stranger and a free Pro subscription is this function, so
// it is worth testing the ways it could wrongly say yes.
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "../src/lib/payments/lemonsqueezy";
import { PaymentConfigError } from "../src/lib/payments/types";

const SECRET = "test-webhook-secret";
const BODY = JSON.stringify({
  meta: { event_name: "subscription_created", custom_data: { user_id: "user-1" } },
  data: { id: "sub-1", attributes: { status: "active", variant_id: "pro-variant" } },
});

const sign = (body: string, secret = SECRET) =>
  createHmac("sha256", secret).update(body).digest("hex");

let saved: string | undefined;
beforeEach(() => {
  saved = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = SECRET;
});
afterEach(() => {
  if (saved === undefined) delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
  else process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = saved;
});

describe("verifyWebhookSignature", () => {
  it("accepts a body signed with the configured secret", () => {
    expect(verifyWebhookSignature(BODY, sign(BODY))).toBe(true);
  });

  // The attack this exists to stop: a real captured event, edited to name a
  // different user or a more expensive plan.
  it("rejects a body that was altered after signing", () => {
    const signature = sign(BODY);
    const tampered = BODY.replace("user-1", "user-2");
    expect(tampered).not.toBe(BODY);
    expect(verifyWebhookSignature(tampered, signature)).toBe(false);
  });

  it("rejects a signature made with a different secret", () => {
    expect(verifyWebhookSignature(BODY, sign(BODY, "not-the-secret"))).toBe(false);
  });

  it("rejects a missing signature header", () => {
    expect(verifyWebhookSignature(BODY, null)).toBe(false);
    expect(verifyWebhookSignature(BODY, "")).toBe(false);
  });

  // Buffer.from(…, "hex") does not throw on junk — it silently decodes as
  // far as it can and returns a short buffer. Without the length guard that
  // would reach timingSafeEqual, which throws on mismatched lengths, and a
  // throw inside the route is a 500 that Lemon Squeezy then retries.
  it("rejects garbage that is not hex, without throwing", () => {
    for (const junk of ["not-hex-at-all", "zz", "🙂", "abc"]) {
      expect(() => verifyWebhookSignature(BODY, junk)).not.toThrow();
      expect(verifyWebhookSignature(BODY, junk)).toBe(false);
    }
  });

  it("rejects a signature of the right shape but the wrong length", () => {
    const good = sign(BODY);
    expect(verifyWebhookSignature(BODY, good.slice(0, -2))).toBe(false);
    expect(verifyWebhookSignature(BODY, good + "ab")).toBe(false);
  });

  // Byte-for-byte, not case- or whitespace-insensitive: anything that
  // "helpfully" normalises input is a place a forgery could slip through.
  it("is exact about the body, down to whitespace", () => {
    const signature = sign(BODY);
    expect(verifyWebhookSignature(BODY + "\n", signature)).toBe(false);
    expect(verifyWebhookSignature(" " + BODY, signature)).toBe(false);
  });

  it("verifies against the RAW body, not a re-serialised object", () => {
    // Round-tripping through JSON.parse/stringify reorders nothing here but
    // does drop the original spacing — which is exactly why the route reads
    // request.text() before it reads request.json().
    const spaced = JSON.stringify(JSON.parse(BODY), null, 2);
    expect(spaced).not.toBe(BODY);
    expect(verifyWebhookSignature(spaced, sign(BODY))).toBe(false);
    expect(verifyWebhookSignature(spaced, sign(spaced))).toBe(true);
  });

  // An unset secret is an operator mistake, and it must not be able to
  // masquerade as a verification failure — the route turns this into a 500
  // "not configured" rather than silently rejecting real events.
  it("throws a typed config error when the secret is unset", () => {
    delete process.env.LEMON_SQUEEZY_WEBHOOK_SECRET;
    expect(() => verifyWebhookSignature(BODY, sign(BODY))).toThrow(PaymentConfigError);
  });

  it("does not fall back to an empty secret", () => {
    process.env.LEMON_SQUEEZY_WEBHOOK_SECRET = "";
    expect(() => verifyWebhookSignature(BODY, sign(BODY, ""))).toThrow(PaymentConfigError);
  });
});
