import type { SimulationResult, HttpMethod, Scenario } from '@/types';

export interface HistoryEntry {
  id: string;
  timestamp: number;
  method: HttpMethod;
  endpoint: string;
  scenario: Scenario;
  status: number;
  statusText: string;
  durationMs: number;
  sizeBytes: number;
  simulated: boolean;
  requestBody?: string;
  delay?: number;
  result: SimulationResult;
}

export const HISTORY_STORAGE_KEY = 'api-failure-lab:history';
export const MAX_HISTORY_ENTRIES = 20;
