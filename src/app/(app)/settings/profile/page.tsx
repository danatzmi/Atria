import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { SUPPORT_EMAIL } from "@/lib/site";
import { NameForm } from "../name-form";
import { DeleteAccountDialog } from "../delete-account-dialog";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("name, email")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Profile
        </h2>

        <div className="mt-4 space-y-5">
          <div>
            <p className="text-sm font-medium text-zinc-700">Name</p>
            <NameForm initialName={profile?.name ?? ""} />
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-700">Email</p>
            {/* Plain text with no pencil: changing an email means
                re-verifying it and handling the window where two addresses
                are live, which is deliberately out of scope. The note says
                so rather than leaving an affordance that does nothing. */}
            <p className="mt-1 text-sm text-zinc-900">
              {profile?.email ?? user.email}
            </p>
            <p className="mt-1 text-xs text-zinc-400">
              To change your email address, please contact support.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-zinc-100 pt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          Support
        </h2>
        <p className="mt-3 text-sm text-zinc-500">
          Need help?{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-zinc-700 underline underline-offset-2 transition-colors hover:text-zinc-900"
          >
            Contact support
          </a>
        </p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-400">
          <Link href="/terms" className="transition-colors hover:text-zinc-600">
            Terms of Service
          </Link>
          <Link href="/privacy" className="transition-colors hover:text-zinc-600">
            Privacy Policy
          </Link>
        </p>
      </section>

      <section className="border-t border-zinc-100 pt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-red-500">
          Danger zone
        </h2>
        <p className="mt-3 text-sm text-zinc-600">
          Deleting your account removes every project, file and note you have.
          This can&rsquo;t be undone.
        </p>
        <div className="mt-4">
          <DeleteAccountDialog />
        </div>
      </section>
    </div>
  );
}
