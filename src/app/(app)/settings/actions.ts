"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PROJECT_FILES_BUCKET } from "@/lib/supabase/storage";
import {
  paymentProvider,
  PaymentConfigError,
  PaymentProviderError,
} from "@/lib/payments";

export type SettingsActionState = { error: string | null; saved?: boolean };

export async function updateName(
  _prevState: SettingsActionState,
  formData: FormData
): Promise<SettingsActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Give yourself a name." };
  if (name.length > 80) return { error: "That name is too long." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to sign in again." };

  // The user's own client, so RLS confines the write to their row — and the
  // column grants from migration 0007 mean `name` is one of the two columns
  // they're allowed to change at all.
  const { error } = await supabase
    .from("users")
    .update({ name })
    .eq("id", user.id);

  if (error) {
    console.error("[atria] updateName failed:", error.message);
    return { error: error.message };
  }

  revalidatePath("/settings");
  return { error: null, saved: true };
}

export type PortalState =
  | { status: "redirect"; url: string }
  | { status: "error"; message: string };

// Hands the customer to the provider's own billing portal.
//
// Atria deliberately has no upgrade/downgrade/cancel UI: card updates,
// proration, dunning, tax and invoices are the processor's job, and
// rebuilding them here would be the largest source of billing bugs in the
// app for no user benefit.
export async function openBillingPortal(): Promise<PortalState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "You need to sign in again." };

  const { data: profile } = await supabase
    .from("users")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .maybeSingle();

  const customerId = profile?.stripe_customer_id;
  // No customer record means they have never subscribed, so the provider
  // has no portal to show them.
  if (!customerId) {
    return {
      status: "error",
      message: "You don't have a subscription to manage yet.",
    };
  }

  try {
    const url = await paymentProvider.createBillingPortalUrl(customerId);
    return { status: "redirect", url };
  } catch (error) {
    if (error instanceof PaymentConfigError) {
      console.error("[atria] billing portal misconfigured:", error.message);
      return {
        status: "error",
        message: "Billing isn't available right now. Please try again later.",
      };
    }
    if (error instanceof PaymentProviderError) {
      console.error("[atria] billing portal failed:", error.message);
      return {
        status: "error",
        message: "Couldn't open the billing portal. Please try again.",
      };
    }
    console.error("[atria] unexpected billing portal error:", error);
    return {
      status: "error",
      message: "Couldn't open the billing portal. Please try again.",
    };
  }
}

// Permanently deletes the account and everything in it.
//
// Order matters and is not interchangeable: storage keys are collected
// FIRST, because deleting the auth user cascades away the very rows that
// record where the files live (auth.users -> public.users -> projects ->
// files). Delete the user first and the objects are orphaned in the bucket
// with nothing left pointing at them.
export async function deleteAccount(): Promise<{ error: string } | never> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to sign in again." };

  // Read with the user's own client so RLS guarantees we can only ever
  // collect this user's objects, even if the queries below were wrong.
  const [{ data: files }, { data: projects }] = await Promise.all([
    supabase.from("files").select("storage_key"),
    supabase.from("projects").select("cover_image"),
  ]);

  const storageKeys = [
    ...(files ?? []).map((f) => f.storage_key),
    // Cover images are NOT rows in `files` — they're a column on projects.
    // Collecting only `files` would leave every cover behind in the bucket.
    ...(projects ?? []).map((p) => p.cover_image),
  ].filter((key): key is string => !!key);

  const admin = createAdminClient();

  if (storageKeys.length > 0) {
    // Chunked: remove() takes a list, and a heavy account could otherwise
    // produce a request large enough to be rejected.
    for (let i = 0; i < storageKeys.length; i += 100) {
      const batch = storageKeys.slice(i, i + 100);
      const { error } = await admin.storage.from(PROJECT_FILES_BUCKET).remove(batch);
      if (error) {
        // Stop rather than proceed: deleting the account now would strand
        // these objects with no record of who owned them.
        console.error("[atria] deleteAccount storage cleanup failed:", error.message);
        return { error: "Couldn't remove your files. Nothing was deleted — please try again." };
      }
    }
  }

  // Cascades through public.users -> projects -> folders/files/blocks.
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error("[atria] deleteAccount failed:", deleteError.message);
    return { error: "Couldn't delete your account. Please try again." };
  }

  // The session is dead, but the cookie isn't — clear it so the browser
  // isn't left holding a token for a user that no longer exists.
  await supabase.auth.signOut();
  redirect("/");
}
