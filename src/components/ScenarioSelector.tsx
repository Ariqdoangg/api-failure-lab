import { CheckCircle2, FileQuestion, Gauge, ServerCrash, Zap } from 'lucide-react';
import type { Scenario } from '@/types';
import type { LucideIcon } from 'lucide-react';

interface ScenarioSelectorProps {
  value: Scenario;
  onChange: (scenario: Scenario) => void;
  disabled?: boolean;
}

interface ScenarioConfig {
  id: Scenario;
  label: string;
  description: string;
  icon: LucideIcon;
}

const SCENARIOS: ScenarioConfig[] = [
  {
    id: 'normal',
    label: 'Normal',
    description: 'Fetch the real API and return its actual response.',
    icon: CheckCircle2,
  },
  {
    id: '404',
    label: '404 Not Found',
    description: 'Simulate a missing resource without calling the API.',
    icon: FileQuestion,
  },
  {
    id: '429',
    label: '429 Too Many Requests',
    description: 'Simulate rate limiting with a Retry-After header.',
    icon: Gauge,
  },
  {
    id: '500',
    label: '500 Internal Server Error',
    description: 'Simulate an unexpected server-side failure.',
    icon: ServerCrash,
  },
  {
    id: 'slow',
    label: 'Slow Response',
    description: 'Call the real API, then delay the response.',
    icon: Zap,
  },
];

export function ScenarioSelector({ value, onChange, disabled }: ScenarioSelectorProps) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
        Failure Scenario
      </span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SCENARIOS.map((s) => {
          const Icon = s.icon;
          const active = value === s.id;
          return (
            <button
              key={s.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(s.id)}
              className={`group flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                active
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <Icon
                className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-400'}`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className={`text-sm font-medium ${active ? 'text-white' : 'text-slate-200'}`}>{s.label}</div>
                <div className="mt-0.5 text-xs leading-snug text-slate-500">{s.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
