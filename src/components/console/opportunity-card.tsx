import Link from "next/link";

type OpportunityCardProps = {
  slug: string;
  tenderNumber: string;
  title: string;
  buyer: string;
  closingDate: string;
  briefing?: string;
  score: number;
  isNew?: boolean;
};

export function OpportunityCard({
  slug,
  tenderNumber,
  title,
  buyer,
  closingDate,
  briefing,
  score,
  isNew = false,
}: OpportunityCardProps) {
  return (
    <Link
      href={`/console/opportunities/${slug}`}
      className="block rounded-2xl border border-black/10 bg-white p-5 transition hover:-translate-y-0.5 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-black/45">
              {tenderNumber}
            </span>

            {isNew ? (
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                New today
              </span>
            ) : null}
          </div>

          <h2 className="mt-2 text-lg font-semibold leading-snug">{title}</h2>
          <p className="mt-1 text-sm text-black/50">{buyer}</p>
        </div>

        <div className="shrink-0 rounded-full border border-black/10 px-3 py-1 text-sm font-semibold">
          {score}%
        </div>
      </div>

      <div className="mt-5 grid gap-3 text-sm md:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-black/40">
            Closing
          </div>
          <div className="mt-1 font-medium">{closingDate}</div>
        </div>

        <div>
          <div className="text-xs uppercase tracking-wide text-black/40">
            Briefing
          </div>
          <div className="mt-1 font-medium">{briefing ?? "None listed"}</div>
        </div>
      </div>
    </Link>
  );
}
