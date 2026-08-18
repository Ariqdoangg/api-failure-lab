import { useMemo, useState } from 'react';
import type { HistoryEntry } from '@/types/history';
import { statusTone, scenarioLabel } from '@/utils/format';

interface LatencyChartProps {
  entries: HistoryEntry[];
}

interface PlotPoint {
  x: number;
  y: number;
  entry: HistoryEntry;
}

const CHART_HEIGHT = 200;
const PADDING = { top: 20, right: 16, bottom: 36, left: 48 };
const Y_TICKS = 4;

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

const TONE_FILL: Record<string, string> = {
  success: '#34d399',
  warning: '#fbbf24',
  error: '#f87171',
  neutral: '#94a3b8',
};

const TONE_STROKE: Record<string, string> = {
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  neutral: '#64748b',
};

export function LatencyChart({ entries }: LatencyChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { points, width, yMax, yTicks, plotWidth, plotHeight } = useMemo(() => {
    const w = 1000;
    const pw = w - PADDING.left - PADDING.right;
    const ph = CHART_HEIGHT - PADDING.top - PADDING.bottom;
    const count = entries.length;
    const maxDuration = Math.max(...entries.map((e) => e.durationMs), 1);
    const yMaxRounded = Math.ceil(maxDuration / 500) * 500 || 500;

    const xStep = count > 1 ? pw / (count - 1) : 0;

    const pts: PlotPoint[] = entries.map((entry, i) => ({
      x: PADDING.left + (count > 1 ? i * xStep : pw / 2),
      y: PADDING.top + ph - (entry.durationMs / yMaxRounded) * ph,
      entry,
    }));

    const ticks: number[] = [];
    for (let i = 0; i <= Y_TICKS; i++) {
      ticks.push((yMaxRounded / Y_TICKS) * i);
    }

    return { points: pts, width: w, yMax: yMaxRounded, yTicks: ticks, plotWidth: pw, plotHeight: ph };
  }, [entries]);

  if (entries.length === 0) return null;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        className="w-full"
        style={{ maxHeight: `${CHART_HEIGHT}px` }}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Latency trend chart"
      >
        {/* Y-axis grid lines and labels */}
        {yTicks.map((tick, i) => {
          const y = PADDING.top + plotHeight - (tick / yMax) * plotHeight;
          return (
            <g key={`y-${i}`}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={width - PADDING.right}
                y2={y}
                stroke="#1e293b"
                strokeWidth={1}
                strokeDasharray={i === 0 ? '0' : '3 3'}
              />
              <text
                x={PADDING.left - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-600 font-mono"
                style={{ fontSize: '10px' }}
              >
                {tick >= 1000 ? `${(tick / 1000).toFixed(tick % 1000 === 0 ? 0 : 1)}k` : tick}
              </text>
            </g>
          );
        })}

        {/* X-axis line */}
        <line
          x1={PADDING.left}
          y1={PADDING.top + plotHeight}
          x2={width - PADDING.right}
          y2={PADDING.top + plotHeight}
          stroke="#334155"
          strokeWidth={1}
        />

        {/* Connecting line */}
        {points.length > 1 && (
          <polyline
            points={points.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke="#334155"
            strokeWidth={1.5}
          />
        )}

        {/* Data points */}
        {points.map((p, i) => {
          const tone = statusTone(p.entry.status);
          const fill = TONE_FILL[tone];
          const stroke = TONE_STROKE[tone];
          const isHovered = hoverIdx === i;
          const radius = isHovered ? 6 : 4;
          return (
            <g key={p.entry.id}>
              {/* Invisible larger hit area */}
              <circle
                cx={p.x}
                cy={p.y}
                r={16}
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                onFocus={() => setHoverIdx(i)}
                onBlur={() => setHoverIdx(null)}
                tabIndex={0}
                role="button"
                aria-label={`${p.entry.status} ${scenarioLabel(p.entry.scenario, p.entry.simulated)} ${p.entry.durationMs}ms`}
              />
              <circle
                cx={p.x}
                cy={p.y}
                r={radius}
                fill={fill}
                stroke={stroke}
                strokeWidth={1.5}
                className="pointer-events-none transition-all"
              />
              {/* X-axis timestamp label */}
              <text
                x={p.x}
                y={CHART_HEIGHT - 10}
                textAnchor="middle"
                className="fill-slate-600 font-mono"
                style={{ fontSize: '9px' }}
              >
                {formatTime(p.entry.timestamp)}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {hoverIdx !== null && points[hoverIdx] ? (
        <ChartTooltip point={points[hoverIdx]} />
      ) : null}
    </div>
  );
}

function ChartTooltip({ point }: { point: PlotPoint }) {
  const entry = point.entry;
  const tone = statusTone(entry.status);
  const toneColor =
    tone === 'success' ? 'text-emerald-400' : tone === 'warning' ? 'text-amber-400' : tone === 'error' ? 'text-red-400' : 'text-slate-400';

  const statusText = entry.status === 0 ? entry.statusText || 'No Response' : `${entry.status} ${entry.statusText}`.trim();

  return (
    <div className="pointer-events-none absolute left-1/2 top-0 z-10 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2.5 shadow-xl">
      <div className={`font-mono text-xs font-medium ${toneColor}`}>{statusText}</div>
      <div className="mt-1 font-mono text-[11px] text-slate-300">{entry.method}</div>
      <div className="mt-0.5 text-xs text-slate-400">{scenarioLabel(entry.scenario, entry.simulated)}</div>
      <div className="mt-0.5 max-w-[220px] truncate font-mono text-[11px] text-slate-500" title={entry.endpoint}>
        {shortEndpoint(entry.endpoint)}
      </div>
      <div className="mt-1 flex items-center gap-3 font-mono text-[11px]">
        <span className="text-slate-300">{entry.durationMs.toLocaleString('en-US')} ms</span>
        <span className="text-slate-600">{formatTime(entry.timestamp)}</span>
      </div>
    </div>
  );
}
