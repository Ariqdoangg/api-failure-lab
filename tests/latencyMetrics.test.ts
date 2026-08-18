import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '../src/types/history';
import { calculateLatencyMetrics } from '../src/utils/latencyMetrics';

function historyWithDurations(...durations: number[]): HistoryEntry[] {
  return durations.map((durationMs) => ({ durationMs }) as HistoryEntry);
}

describe('calculateLatencyMetrics', () => {
  it('calculates rounded average, fastest, slowest, and count', () => {
    expect(calculateLatencyMetrics(historyWithDurations(18, 41, 10))).toEqual({
      average: 23,
      fastest: 10,
      slowest: 41,
      count: 3,
    });
  });

  it('returns zeroed metrics for empty input', () => {
    expect(calculateLatencyMetrics([])).toEqual({
      average: 0,
      fastest: 0,
      slowest: 0,
      count: 0,
    });
  });
});
