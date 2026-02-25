import type { AssetsBarGroup, PerformanceSeries } from '../../types/finance';

type ChartCardsProps = {
  assetsBars: AssetsBarGroup[];
  performanceSeries: PerformanceSeries;
};

export function ChartCards({ assetsBars, performanceSeries }: ChartCardsProps): JSX.Element {
  const primaryPath = linePath(performanceSeries.primary, 680, 240);
  const secondaryPath = linePath(performanceSeries.secondary, 680, 240);

  return (
    <section className="grid gap-4 xl:grid-cols-2" aria-label="Charts">
      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Assets</h2>
          <span className="text-sm text-slate-500">Last 30 days</span>
        </header>

        <div className="space-y-2">
          <div className="grid grid-cols-10 items-end gap-2">
            {assetsBars.map((bar) => (
              <div key={bar.id} className="flex h-36 items-end justify-center gap-1">
                <span
                  className="w-2 rounded-sm bg-sky-400"
                  style={{ height: `${bar.first}px` }}
                  aria-hidden="true"
                />
                <span
                  className="w-2 rounded-sm bg-indigo-500"
                  style={{ height: `${bar.third}px` }}
                  aria-hidden="true"
                />
                <span
                  className="w-2 rounded-sm bg-orange-400"
                  style={{ height: `${bar.second}px` }}
                  aria-hidden="true"
                />
              </div>
            ))}
          </div>

          <div className="grid grid-cols-10 gap-2 text-center text-[11px] text-slate-400">
            {assetsBars.map((bar) => (
              <span key={`${bar.id}-label`}>{bar.label}</span>
            ))}
          </div>
        </div>
      </article>

      <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <header className="mb-4 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Performance</h2>
          <span className="text-sm text-slate-500">Last 30 days</span>
        </header>

        <div className="relative h-[180px] rounded-lg bg-slate-50 px-2 py-1">
          <svg
            viewBox="0 0 680 240"
            className="h-full w-full"
            role="img"
            aria-label="Performance lines"
          >
            {new Array(16).fill(null).map((_, index) => {
              const x = (680 / 15) * index;
              return <line key={x} x1={x} y1={0} x2={x} y2={240} stroke="#e5e7eb" strokeWidth="1" />;
            })}
            <path d={primaryPath} fill="none" stroke="#22c7e7" strokeWidth="6" strokeLinecap="round" />
            <path
              d={secondaryPath}
              fill="none"
              stroke="#6b4fd3"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
          <span>3 Oct 2024</span>
          <span>17 Oct 2024</span>
          <span>3 Nov 2024</span>
        </div>
      </article>
    </section>
  );
}

function linePath(series: number[], width: number, height: number): string {
  if (series.length === 0) {
    return '';
  }

  const maxValue = Math.max(...series);
  const minValue = Math.min(...series);
  const range = maxValue - minValue || 1;

  return series
    .map((value, index) => {
      const x = (width / (series.length - 1)) * index;
      const normalized = (value - minValue) / range;
      const y = height - normalized * height;
      const prefix = index === 0 ? 'M' : 'L';
      return `${prefix} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}
