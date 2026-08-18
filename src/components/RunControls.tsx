import { Play, Loader2, RotateCcw } from 'lucide-react';

interface RunControlsProps {
  onRun: () => void;
  onReset: () => void;
  isRunning: boolean;
  disabled?: boolean;
}

export function RunControls({ onRun, onReset, isRunning, disabled }: RunControlsProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onRun}
        disabled={isRunning || disabled}
        className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRunning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Running…</span>
          </>
        ) : (
          <>
            <Play className="h-4 w-4" aria-hidden="true" />
            <span>Run Simulation</span>
          </>
        )}
      </button>
      <button
        type="button"
        onClick={onReset}
        disabled={isRunning || disabled}
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label="Reset configuration"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        <span className="hidden sm:inline">Reset</span>
      </button>
    </div>
  );
}
