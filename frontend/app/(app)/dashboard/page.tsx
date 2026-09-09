import Link from 'next/link';

const KPIS = [
  { label: 'New today', value: '12', icon: '+', bg: '#DCF0E4', color: '#157A52' },
  { label: 'Closing this week', value: '5', icon: 'R', bg: '#FFE08A', color: '#7A5C00' },
  { label: 'Active bids', value: '4', icon: 'T', bg: '#DCF0E4', color: '#157A52' },
  { label: 'Submissions due', value: '2', icon: 'W', bg: '#FFDAD6', color: '#BA1A1A' }
];

const DEADLINES = [
  { day: '27', mon: 'Jun', title: 'Supply of bulk water meters', meta: 'City of Tshwane', chip: '1 day', chipBg: '#FFDAD6', chipText: '#8C0009' },
  { day: '04', mon: 'Jul', title: 'ICT network upgrade', meta: 'Ekurhuleni Metro', chip: '8 days', chipBg: '#EAEDF0', chipText: '#44474B' },
  { day: '19', mon: 'Jul', title: 'Cleaning services (24 mo)', meta: 'eThekwini', chip: '23 days', chipBg: '#EAEDF0', chipText: '#44474B' }
];

export default async function DashboardPage() {
  return (
    <main className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <div className="flex items-center gap-4">
          <button className="rounded-md bg-[#157A52] px-4 py-2 font-semibold text-white hover:bg-[#0F5C3D]">Sync now</button>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#157A52] font-bold text-white">AD</div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-4 gap-4">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-500">{kpi.label}</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: kpi.bg, color: kpi.color }}>{kpi.icon}</span>
            </div>
            <div className="text-3xl font-bold" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-200 p-5">
          <h2 className="text-lg font-bold">Upcoming deadlines</h2>
          <Link href="/app/workspace" className="text-sm font-semibold text-[#157A52]">View all</Link>
        </div>
        {DEADLINES.map((d) => (
          <div key={d.title} className="flex items-center gap-4 border-b border-gray-100 p-4 hover:bg-gray-50">
            <div className="w-12 text-center">
              <div className="text-lg font-bold">{d.day}</div>
              <div className="text-xs font-semibold uppercase text-gray-400">{d.mon}</div>
            </div>
            <div className="flex-1">
              <div className="font-semibold">{d.title}</div>
              <div className="text-xs text-gray-500">{d.meta}</div>
            </div>
            <span className="rounded-md px-3 py-1.5 text-xs font-semibold" style={{ background: d.chipBg, color: d.chipText }}>{d.chip}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
