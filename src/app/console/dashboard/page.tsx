import { MetricCard } from "@/components/console/metric-card";
import { OpportunityCard } from "@/components/console/opportunity-card";

const opportunities = [
  {
    slug: "UMUZ-11-2026",
    tenderNumber: "UMUZ/11/2026",
    title: "Panel of Town & Regional Planning Consultants",
    buyer: "Umuziwabantu Local Municipality",
    closingDate: "23 Sep 2026 · 12:00",
    briefing: "02 Sep 2026",
    score: 96,
    isNew: true,
  },
  {
    slug: "CED-04-2026-2027",
    tenderNumber: "CED 04/2026-2027",
    title: "Professional Land Surveyor and Town & Regional Planner",
    buyer: "Cederberg Municipality",
    closingDate: "08 Sep 2026 · 12:00",
    score: 94,
  },
  {
    slug: "IHLM-43-2026-27-PLAN",
    tenderNumber: "IHLM/43/2026-27/PLAN",
    title: "Lusikisiki Precinct Plan",
    buyer: "Ingquza Hill Local Municipality",
    closingDate: "16 Sep 2026",
    score: 91,
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-black/45">Sunday, 30 August 2026</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Opportunity Dashboard
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-black/50">
          Active planning, surveying and spatial-intelligence opportunities matched
          against NFA capabilities.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active opportunities" value="18" />
        <MetricCard label="New today" value="3" note="First seen today" />
        <MetricCard label="Briefings next 7 days" value="4" />
        <MetricCard label="Closing next 14 days" value="9" />
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Highest-fit opportunities</h2>
            <p className="text-sm text-black/45">
              Ranked by capability fit and deadline relevance.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {opportunities.map((opportunity) => (
            <OpportunityCard key={opportunity.slug} {...opportunity} />
          ))}
        </div>
      </section>
    </div>
  );
}
