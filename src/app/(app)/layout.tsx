import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UserMenu } from "./user-menu";

export default async function AppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Just the display name for the avatar/menu; the rest of the profile is
  // Settings' concern.
  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      {/* Dark, thin, and the only element that persists across every page —
          so the wordmark doubles as the way back to the project list. The
          bottom border is gone: against black it read as a seam rather than
          a divider, and the color change already separates it. */}
      {/* py-4 on phones so the wordmark and Sign out clear the ~44px
          minimum comfortable tap target; back to the thin py-3 at md. */}
      <header className="flex items-center justify-between bg-zinc-950 px-6 py-4 print:hidden md:py-3">
        <Link
          href="/projects"
          className="text-lg font-semibold tracking-tight text-white transition-opacity hover:opacity-80"
        >
          Atria
        </Link>
        <UserMenu name={profile?.name ?? null} email={user.email ?? null} />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
