import { Clock } from 'lucide-react';

interface DelayControlProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

const MIN = 0;
const MAX = 5000;
const STEP = 100;

export function DelayControl({ value, onChange, disabled }: DelayControlProps) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Artificial Delay</span>
        <span className="font-mono text-sm text-slate-200">{value.toLocaleString('en-US')} ms</span>
      </div>
      <div className="flex items-center gap-3">
        <Clock className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-800 accent-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Artificial delay in milliseconds"
        />
      </div>
      <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-slate-600">
        <span>0 ms</span>
        <span>5000 ms</span>
      </div>
    </div>
  );
}
