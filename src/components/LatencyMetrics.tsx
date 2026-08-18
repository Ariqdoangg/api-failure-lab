import { Activity, Gauge, TrendingUp, Hash } from 'lucide-react';
import type { LatencyMetricsData } from '@/utils/latencyMetrics';
import type { LucideIcon } from 'lucide-react';

interface LatencyMetricsProps {
  metrics: LatencyMetricsData;
}

function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0 ms';
  return `${Math.round(ms).toLocaleString('en-US')} ms`;
}

function MetricCard({ icon: Icon, label, value, accent }: { icon: LucideIcon; label: string; value: string; accent: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2.5">
      <Icon className={`h-4 w-4 shrink-0 ${accent}`} aria-hidden="true" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
        <div className="truncate font-mono text-sm text-slate-200">{value}</div>
      </div>
    </div>
  );
}

export function LatencyMetrics({ metrics }: LatencyMetricsProps) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      <MetricCard icon={Activity} label="Average" value={formatMs(metrics.average)} accent="text-blue-400" />
      <MetricCard icon={Gauge} label="Fastest" value={formatMs(metrics.fastest)} accent="text-emerald-400" />
      <MetricCard icon={TrendingUp} label="Slowest" value={formatMs(metrics.slowest)} accent="text-amber-400" />
      <MetricCard icon={Hash} label="Requests" value={String(metrics.count)} accent="text-slate-400" />
    </div>
  );
}
