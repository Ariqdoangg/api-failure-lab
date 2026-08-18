import { CheckCircle2, AlertTriangle, OctagonAlert, Clock, Database, Activity, Link2, Tag } from 'lucide-react';
import type { SimulationResult } from '@/types';
import { formatDuration, formatSize, statusTone, statusLabel, scenarioLabel } from '@/utils/format';
import type { LucideIcon } from 'lucide-react';

interface ResultSummaryProps {
  result: SimulationResult;
}

const TONE_STYLES: Record<string, { icon: LucideIcon; badge: string; dot: string }> = {
  success: { icon: CheckCircle2, badge: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400', dot: 'bg-emerald-500' },
  warning: { icon: AlertTriangle, badge: 'border-amber-500/40 bg-amber-500/10 text-amber-400', dot: 'bg-amber-500' },
  error: { icon: OctagonAlert, badge: 'border-red-500/40 bg-red-500/10 text-red-400', dot: 'bg-red-500' },
  neutral: { icon: Activity, badge: 'border-slate-600 bg-slate-700/30 text-slate-300', dot: 'bg-slate-500' },
};

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="truncate font-mono text-sm text-slate-200">{value}</div>
      </div>
    </div>
  );
}

export function ResultSummary({ result }: ResultSummaryProps) {
  const tone = TONE_STYLES[statusTone(result.status)];
  const ToneIcon = tone.icon;
  const isNetworkError = result.status === 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-mono text-sm font-medium ${tone.badge}`}
        >
          <ToneIcon className="h-4 w-4" aria-hidden="true" />
          {statusLabel(result.status, result.statusText)}
        </span>
        {result.simulated ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/60 px-2 py-1 text-xs text-slate-400">
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
            Simulated
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Metric icon={Clock} label="Response Time" value={formatDuration(result.durationMs)} />
        <Metric icon={Database} label="Response Size" value={formatSize(result.sizeBytes)} />
        <Metric icon={Tag} label="Scenario" value={scenarioLabel(result.scenario, result.simulated)} />
      </div>

      <div className="flex items-start gap-2.5 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
        <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Endpoint</div>
          <div className="break-all font-mono text-xs text-slate-300">
            <span className="mr-1.5 font-medium text-slate-400">{result.method || 'GET'}</span>
            {result.endpoint || '—'}
          </div>
        </div>
      </div>

      {isNetworkError && result.error ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
          <div className="min-w-0">
            <div className="text-xs font-medium text-red-300">Request failed</div>
            <div className="mt-0.5 break-words text-xs text-red-400/80">{result.error}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
