"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  paymentProvider,
  PaymentConfigError,
  PaymentProviderError,
  type PaidPlanTier,
} from "@/lib/payments";

export type CheckoutState =
  // Send the browser here.
  | { status: "redirect"; url: string }
  // Not signed in — they need an account before they can be billed.
  | { status: "signup_required" }
  | { status: "error"; message: string };

// Starts a checkout for a paid plan.
//
// Provider-agnostic on purpose: it talks to the PaymentProvider interface
// and never names Lemon Squeezy, so replacing the processor doesn't touch
// this file.
export async function createCheckoutSession(
  plan: PaidPlanTier
): Promise<CheckoutState> {
  // Never trust the tier from the client — it arrives from a button in the
  // page and decides what someone is charged for.
  if (plan !== "basic" && plan !== "pro") {
    return { status: "error", message: "Unknown plan." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // A checkout has to be attached to an account, or a successful payment
  // has no user to upgrade.
  if (!user) return { status: "signup_required" };

  // Built from the request rather than a hardcoded env var so this works
  // unchanged on localhost, a preview deploy, and production.
  const host = (await headers()).get("host");
  const proto = host?.startsWith("localhost") ? "http" : "https";
  const redirectUrl = host ? `${proto}://${host}/projects` : undefined;

  try {
    const url = await paymentProvider.createCheckout(plan, user.id, {
      email: user.email,
      redirectUrl,
    });
    return { status: "redirect", url };
  } catch (error) {
    // Config problems are the operator's, not the customer's — say so
    // without implying they did something wrong, and log the detail.
    if (error instanceof PaymentConfigError) {
      console.error("[atria] checkout misconfigured:", error.message);
      return {
        status: "error",
        message: "Payments aren't available right now. Please try again later.",
      };
    }
    if (error instanceof PaymentProviderError) {
      console.error("[atria] checkout failed:", error.message);
      return {
        status: "error",
        message: "Couldn't start checkout. Please try again.",
      };
    }
    console.error("[atria] unexpected checkout error:", error);
    return {
      status: "error",
      message: "Couldn't start checkout. Please try again.",
    };
  }
}
