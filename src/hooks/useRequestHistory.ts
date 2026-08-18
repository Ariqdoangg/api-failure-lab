import { useCallback, useEffect, useState } from 'react';
import type { HistoryEntry } from '@/types/history';
import { HISTORY_STORAGE_KEY, MAX_HISTORY_ENTRIES } from '@/types/history';
import type { SimulationResult, HttpMethod } from '@/types';

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as HistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // storage full or unavailable; no-op
  }
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface UseRequestHistory {
  history: HistoryEntry[];
  selectedId: string | null;
  addEntry: (result: SimulationResult, method: HttpMethod) => void;
  clearHistory: () => void;
  selectEntry: (id: string | null) => void;
}

export function useRequestHistory(): UseRequestHistory {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const addEntry = useCallback((result: SimulationResult, method: HttpMethod) => {
    const entry: HistoryEntry = {
      id: generateId(),
      timestamp: Date.now(),
      method,
      endpoint: result.endpoint,
      scenario: result.scenario,
      status: result.status,
      statusText: result.statusText,
      durationMs: result.durationMs,
      sizeBytes: result.sizeBytes,
      simulated: result.simulated,
      requestBody: result.requestBody,
      delay: result.delay,
      result,
    };
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, MAX_HISTORY_ENTRIES);
      saveHistory(next);
      return next;
    });
    setSelectedId(entry.id);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    setSelectedId(null);
    saveHistory([]);
  }, []);

  const selectEntry = useCallback((id: string | null) => {
    setSelectedId(id);
  }, []);

  return { history, selectedId, addEntry, clearHistory, selectEntry };
}
