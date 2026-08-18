import { CheckCircle2, AlertTriangle, OctagonAlert, Activity, Trash2, History as HistoryIcon } from 'lucide-react';
import type { HistoryEntry } from '@/types/history';
import { statusTone, scenarioLabel } from '@/utils/format';
import type { LucideIcon } from 'lucide-react';

interface RequestHistoryProps {
  history: HistoryEntry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}

const TONE_ICON: Record<string, LucideIcon> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  error: OctagonAlert,
  neutral: Activity,
};

const TONE_TEXT: Record<string, string> = {
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  error: 'text-red-400',
  neutral: 'text-slate-400',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  return `${h}:${m}:${s}`;
}

function shortEndpoint(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.host + parsed.pathname;
  } catch {
    return url;
  }
}

export function RequestHistory({ history, selectedId, onSelect, onClear }: RequestHistoryProps) {
  const isEmpty = history.length === 0;

  return (
    <section
      aria-label="Recent requests"
      className="rounded-xl border border-slate-800 bg-slate-900/30 p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HistoryIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-white">Recent Requests</h2>
          {!isEmpty ? (
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{history.length}</span>
          ) : null}
        </div>
        {!isEmpty ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-400 transition-colors hover:border-red-500/40 hover:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            aria-label="Clear history"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            Clear History
          </button>
        ) : null}
      </div>

      {isEmpty ? (
        <p className="py-6 text-center text-xs text-slate-600">Your completed simulations will appear here.</p>
      ) : (
        <div className="-mx-2 overflow-x-auto scrollbar-thin">
          <table className="w-full min-w-[640px] border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="px-2 py-2 font-medium">Status</th>
                <th className="px-2 py-2 font-medium">Method</th>
                <th className="px-2 py-2 font-medium">Endpoint</th>
                <th className="px-2 py-2 font-medium">Scenario</th>
                <th className="px-2 py-2 text-right font-medium">Latency</th>
                <th className="px-2 py-2 text-right font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {history.map((entry) => {
                const tone = statusTone(entry.status);
                const ToneIcon = TONE_ICON[tone];
                const active = entry.id === selectedId;
                const label = entry.status === 0 ? entry.statusText || 'No Response' : `${entry.status}`;
                return (
                  <tr
                    key={entry.id}
                    onClick={() => onSelect(entry.id)}
                    className={`cursor-pointer border-b border-slate-800/50 transition-colors last:border-0 ${
                      active ? 'bg-blue-500/10' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="px-2 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 font-mono font-medium ${TONE_TEXT[tone]}`}>
                        <ToneIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        {label}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 font-mono text-slate-400">{entry.method}</td>
                    <td className="max-w-[240px] truncate px-2 py-2.5 font-mono text-slate-300" title={entry.endpoint}>
                      {shortEndpoint(entry.endpoint)}
                    </td>
                    <td className="px-2 py-2.5 text-slate-400">{scenarioLabel(entry.scenario, entry.simulated)}</td>
                    <td className="px-2 py-2.5 text-right font-mono text-slate-300">{entry.durationMs.toLocaleString('en-US')} ms</td>
                    <td className="px-2 py-2.5 text-right font-mono text-slate-500">{formatTime(entry.timestamp)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
