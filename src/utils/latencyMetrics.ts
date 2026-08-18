import type { HistoryEntry } from '@/types/history';

export interface LatencyMetricsData {
  average: number;
  fastest: number;
  slowest: number;
  count: number;
}

export function calculateLatencyMetrics(entries: HistoryEntry[]): LatencyMetricsData {
  if (entries.length === 0) {
    return { average: 0, fastest: 0, slowest: 0, count: 0 };
  }
  const durations = entries.map((e) => e.durationMs);
  const sum = durations.reduce((acc, d) => acc + d, 0);
  return {
    average: Math.round(sum / durations.length),
    fastest: Math.min(...durations),
    slowest: Math.max(...durations),
    count: durations.length,
  };
}

export const MAX_CHART_ENTRIES = 10;
