import { lemonSqueezyProvider } from "./lemonsqueezy";
import type { PaymentProvider } from "./types";

// The single injection point. Everything else in the app depends on the
// PaymentProvider interface, so switching processors is this one line plus
// a new adapter file — no UI, action, or business logic changes.
export const paymentProvider: PaymentProvider = lemonSqueezyProvider;

export * from "./types";
