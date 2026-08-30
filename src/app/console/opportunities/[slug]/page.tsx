import Link from "next/link";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function OpportunityDetailPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/console/opportunities"
          className="text-sm text-black/45 hover:text-black"
        >
          ← Back to opportunities
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-black/40">
              UMUZ/11/2026
            </p>
            <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight">
              Panel of Town & Regional Planning Consultants
            </h1>
            <p className="mt-2 text-sm text-black/50">
              Umuziwabantu Local Municipality
            </p>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white px-5 py-4">
            <div className="text-xs uppercase tracking-wide text-black/40">
              NFA fit
            </div>
            <div className="mt-1 text-3xl font-semibold">96%</div>
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <section className="rounded-2xl border border-black/10 bg-white p-6">
          <h2 className="text-lg font-semibold">Opportunity summary</h2>
          <p className="mt-4 text-sm leading-7 text-black/60">
            Appointment of a panel of professional town and regional planning
            consultants for municipal planning assignments over a multi-year
            period.
          </p>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-black/40">
                Tender number
              </div>
              <div className="mt-1 font-medium">UMUZ/11/2026</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-black/40">
                Source slug
              </div>
              <div className="mt-1 font-medium">{slug}</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-black/40">
                Closing
              </div>
              <div className="mt-1 font-medium">23 Sep 2026 · 12:00</div>
            </div>

            <div>
              <div className="text-xs uppercase tracking-wide text-black/40">
                Compulsory briefing
              </div>
              <div className="mt-1 font-medium">02 Sep 2026</div>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-2xl border border-black/10 bg-white p-6">
            <h2 className="text-lg font-semibold">Why it matches NFA</h2>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                "Town & Regional Planning",
                "Land Use Management",
                "Spatial Planning",
                "Municipal Advisory",
              ].map((capability) => (
                <span
                  key={capability}
                  className="rounded-full bg-black/[0.04] px-3 py-1.5 text-xs font-medium"
                >
                  {capability}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-black/10 bg-white p-6">
            <h2 className="text-lg font-semibold">Source</h2>
            <p className="mt-3 text-sm leading-6 text-black/50">
              Official source traceability will be wired in the ingestion branch.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
