"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Sidebar on desktop, a horizontal tab bar on mobile — one list, two
// presentations, so the active item can't disagree between them.
const SECTIONS = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/billing", label: "Billing" },
];

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="flex gap-1 overflow-x-auto border-b border-zinc-100 pb-3 md:w-48 md:shrink-0 md:flex-col md:border-b-0 md:pb-0"
    >
      {SECTIONS.map((section) => {
        const isActive = pathname === section.href;
        return (
          <Link
            key={section.href}
            href={section.href}
            aria-current={isActive ? "page" : undefined}
            className={`shrink-0 touch-manipulation rounded-md px-3 py-2 text-sm transition-colors ${
              isActive
                ? "bg-zinc-100 font-medium text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
            }`}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
