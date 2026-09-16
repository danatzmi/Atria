// The adapter boundary. No network: these assert the contract the rest of
// the app depends on — that a missing key fails as a handled, typed error
// rather than a crash, and that plan names map to the right variant.
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { PaymentConfigError } from "../src/lib/payments/types";
import { lemonSqueezyProvider } from "../src/lib/payments/lemonsqueezy";

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
