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

export default function OpportunitiesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Opportunities</h1>
        <p className="mt-2 text-sm text-black/50">
          Active tenders matched to NFA capabilities.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["All active", "New today", "Briefing soon", "Closing soon", "High fit"].map(
          (filter) => (
            <button
              key={filter}
              type="button"
              className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm text-black/65"
            >
              {filter}
            </button>
          ),
        )}
      </div>

      <div className="space-y-4">
        {opportunities.map((opportunity) => (
          <OpportunityCard key={opportunity.slug} {...opportunity} />
        ))}
      </div>
    </div>
  );
}
