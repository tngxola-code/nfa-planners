"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/app/dashboard', label: 'Dashboard' },
  { href: '/app/search', label: 'Search' },
  { href: '/app/workspace', label: 'Workspace' }
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function onSignOut() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    router.replace('/login');
    router.refresh();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-[260px] flex-none flex-col bg-[#2D3135] text-white">
      <div className="border-b border-white/10 p-5">
        <div className="text-2xl font-bold text-white">NFA</div>
        <div className="mt-2 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Tender Intelligence</div>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href} className={active ? "flex items-center gap-3 rounded-md border-l-4 border-[#2C9C6F] bg-white/10 px-3 py-2 font-semibold text-white" : "flex items-center gap-3 rounded-md px-3 py-2 font-medium text-[#c4c9ce] hover:bg-white/5"}>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex flex-col gap-3 border-t border-white/10 p-4">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 animate-pulse rounded-full bg-[#2E7D52]" />
          <span className="text-xs text-gray-400">Live feed</span>
        </div>
        <button onClick={onSignOut} className="w-full rounded-md border border-white/15 px-3 py-2 text-left text-xs font-semibold text-[#c4c9ce] hover:bg-white/5">Sign out</button>
      </div>
    </aside>
  );
}
