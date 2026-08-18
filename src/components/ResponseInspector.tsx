import { ResultSummary } from './ResultSummary';
import { ResponseViewer } from './ResponseViewer';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { History } from 'lucide-react';
import type { SimulationResult, ApiError } from '@/types';

interface ResponseInspectorProps {
  result: SimulationResult | null;
  error: ApiError | null;
  isRunning: boolean;
  isHistorical?: boolean;
}

export function ResponseInspector({ result, error, isRunning, isHistorical }: ResponseInspectorProps) {
  return (
    <section aria-label="Response inspector" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Response Inspector</h2>
          <p className="mt-0.5 text-xs text-slate-500">Inspect the outcome of your simulation.</p>
        </div>
        {isHistorical && result ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-[11px] text-slate-400">
            <History className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            Viewing past result
          </span>
        ) : null}
      </div>

      {isRunning && !result ? (
        <div className="flex h-full min-h-[300px] flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/20 px-6 py-16 text-center">
          <div className="h-2.5 w-2.5 animate-pulse-soft rounded-full bg-blue-400" />
          <p className="mt-4 text-xs text-slate-400">Running simulation…</p>
        </div>
      ) : error ? (
        <ErrorState error={error} />
      ) : result ? (
        <div className="space-y-4 animate-fade-in">
          <ResultSummary result={result} />
          <ResponseViewer result={result} />
        </div>
      ) : (
        <EmptyState />
      )}
    </section>
  );
}
