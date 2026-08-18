import { AlertTriangle, ShieldAlert, WifiOff, Clock, ServerCog } from 'lucide-react';
import type { ApiError } from '@/types';
import type { LucideIcon } from 'lucide-react';

interface ErrorStateProps {
  error: ApiError;
}

const KIND_META: Record<ApiError['kind'], { icon: LucideIcon; title: string }> = {
  validation: { icon: ShieldAlert, title: 'Validation Error' },
  network: { icon: WifiOff, title: 'Network Error' },
  timeout: { icon: Clock, title: 'Request Timeout' },
  backend: { icon: ServerCog, title: 'Backend Error' },
  unknown: { icon: AlertTriangle, title: 'Unexpected Error' },
};

export function ErrorState({ error }: ErrorStateProps) {
  const meta = KIND_META[error.kind];
  const Icon = meta.icon;

  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-red-500/20 bg-red-500/5 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10">
        <Icon className="h-6 w-6 text-red-400" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-red-300">{meta.title}</h3>
      <p className="mt-1.5 max-w-md break-words text-xs text-red-400/80">{error.message}</p>
    </div>
  );
}
