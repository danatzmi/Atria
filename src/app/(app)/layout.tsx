import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../(auth)/actions";

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

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 print:hidden">
        <span className="text-lg font-semibold tracking-tight text-zinc-900">
          Atria
        </span>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-zinc-500 transition-colors hover:text-zinc-900"
          >
            Sign out
          </button>
        </form>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
