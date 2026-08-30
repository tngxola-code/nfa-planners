import Link from "next/link";
import type { ReactNode } from "react";

type ConsoleShellProps = {
  children: ReactNode;
};

const navItems = [
  { href: "/console/dashboard", label: "Dashboard" },
  { href: "/console/opportunities", label: "Opportunities" },
  { href: "/console/notifications", label: "Notifications" },
];

export function ConsoleShell({ children }: ConsoleShellProps) {
  return (
    <div className="min-h-screen bg-[#f5f5f2] text-[#172033]">
      <div className="grid min-h-screen grid-cols-[240px_1fr]">
        <aside className="border-r border-black/10 bg-white px-5 py-6">
          <div className="mb-10">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-black/45">
              NFA
            </div>
            <div className="mt-1 text-lg font-semibold">
              Opportunity Console
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-black/65 transition hover:bg-black/[0.04] hover:text-black"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        <div className="min-w-0">
          <header className="flex h-16 items-center justify-between border-b border-black/10 bg-white px-8">
            <div>
              <div className="text-sm font-medium">NFA Town & Regional Planners</div>
              <div className="text-xs text-black/45">
                Planning. Land. Spatial Intelligence.
              </div>
            </div>

            <div className="text-sm text-black/55">Internal Console</div>
          </header>

          <main className="px-8 py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
