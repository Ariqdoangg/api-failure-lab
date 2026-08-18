import { useMemo } from 'react';
import { LineChart as LineChartIcon } from 'lucide-react';
import type { HistoryEntry } from '@/types/history';
import { LatencyChart } from './LatencyChart';
import { LatencyMetrics } from './LatencyMetrics';
import { calculateLatencyMetrics, MAX_CHART_ENTRIES } from '@/utils/latencyMetrics';

interface LatencyAnalyticsProps {
  history: HistoryEntry[];
}

export function LatencyAnalytics({ history }: LatencyAnalyticsProps) {
  const { chartEntries, metrics } = useMemo(() => {
    const latest = history.slice(0, MAX_CHART_ENTRIES);
    const reversed = [...latest].reverse();
    return {
      chartEntries: reversed,
      metrics: calculateLatencyMetrics(latest),
    };
  }, [history]);

  const isEmpty = chartEntries.length === 0;

  return (
    <section
      aria-label="Latency trend"
      className="rounded-xl border border-slate-800 bg-slate-900/30 p-5"
    >
      <div className="mb-4 flex items-center gap-2">
        <LineChartIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
        <h2 className="text-sm font-semibold text-white">Latency Trend</h2>
        {!isEmpty ? (
          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
            {chartEntries.length} of {MAX_CHART_ENTRIES}
          </span>
        ) : null}
      </div>

      {isEmpty ? (
        <p className="py-10 text-center text-xs text-slate-600">
          Run a few simulations to visualize latency trends.
        </p>
      ) : (
        <div className="space-y-4">
          <LatencyMetrics metrics={metrics} />
          <LatencyChart entries={chartEntries} />
        </div>
      )}
    </section>
  );
}
