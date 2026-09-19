import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { HeroAnimation } from "./hero-animation";
import { PricingWidget } from "@/components/pricing-widget";

export default async function MarketingHome() {
  // A signed-in visitor almost certainly wants their work, not the pitch.
  // Signed-out visitors see the page rather than being bounced to /login,
  // which is what the old root route did — there was nowhere to explain
  // what Atria is before asking for an account.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/projects");

  return (
    <div className="flex min-h-full flex-col bg-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-lg font-semibold tracking-tight text-zinc-900">
          Atria
        </span>
        <Link
          href="/login"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6">
        <section className="pt-16 text-center sm:pt-24">
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight text-zinc-900 sm:text-5xl">
            The beautiful digital folder for real-world projects.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-zinc-500">
            A calm, uncluttered workspace for architects, designers, and planners.
          </p>
          <div className="mt-8">
            {/* Scrolls to the plans rather than jumping straight to
                signup — the visitor picks a plan first, which is what the
                pricing widget below is for. A plain anchor, so it works
                before hydration. */}
            <a
              href="#pricing"
              className="inline-flex touch-manipulation items-center rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 active:bg-zinc-700"
            >
              Get started
            </a>
          </div>
        </section>

        <section className="mt-16 sm:mt-20">
          <HeroAnimation />
        </section>

        <PricingWidget />

      </main>

      <footer className="mx-auto mt-24 w-full max-w-6xl px-6 py-10 sm:mt-32">
        <p className="border-t border-zinc-100 pt-8 text-sm text-zinc-400">
          Atria — a beautiful digital binder for real-world projects.
        </p>
      </footer>
    </div>
  );
}
