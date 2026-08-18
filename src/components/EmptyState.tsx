import { FlaskConical } from 'lucide-react';

export function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/20 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-800 bg-slate-900">
        <FlaskConical className="h-6 w-6 text-slate-500" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-sm font-medium text-slate-300">No simulation yet</h3>
      <p className="mt-1 max-w-sm text-xs text-slate-500">
        Configure a scenario and run your first API simulation.
      </p>
    </div>
  );
}
