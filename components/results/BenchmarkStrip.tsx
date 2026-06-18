import { benchmarksForFirmType, fmtGbp } from "@/lib/enforcement/select";

/**
 * A thin headline strip of enforcement KPIs, shown at the top of results pages so
 * the credibility numbers are visible without opening the Benchmarks tab.
 */
export default function BenchmarkStrip() {
  const b = benchmarksForFirmType("all");
  if (b.totalCases === 0) return null;
  const kpis = [
    { label: "Enforcement cases", value: String(b.totalCases) },
    { label: "Total penalties", value: fmtGbp(b.fineStats.totalGbp) },
    { label: "Median fine", value: fmtGbp(b.fineStats.medianGbp) },
    { label: "Largest", value: fmtGbp(b.fineStats.maxGbp) },
  ];
  return (
    <div className="glass-card rounded-2xl p-4 mb-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
      {kpis.map((k) => (
        <div key={k.label} className="text-center">
          <div className="text-xl font-bold text-foreground tabular-nums">{k.value}</div>
          <div className="text-[11px] text-text-muted mt-0.5">{k.label}</div>
        </div>
      ))}
    </div>
  );
}
