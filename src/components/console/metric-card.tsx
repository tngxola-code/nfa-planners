type MetricCardProps = {
  label: string;
  value: string;
  note?: string;
};

export function MetricCard({ label, value, note }: MetricCardProps) {
  return (
    <section className="rounded-2xl border border-black/10 bg-white p-5">
      <p className="text-sm text-black/50">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
      {note ? <p className="mt-2 text-xs text-black/40">{note}</p> : null}
    </section>
  );
}
