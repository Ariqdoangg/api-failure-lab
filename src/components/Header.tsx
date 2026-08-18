import { FlaskConical } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-slate-800/80 bg-slate-950/60 backdrop-blur-sm sticky top-0 z-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900">
            <FlaskConical className="h-5 w-5 text-blue-400" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-semibold tracking-tight text-white">API Failure Lab</h1>
            <span className="rounded-md border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
              v0.4
            </span>
          </div>
          <p className="ml-2 hidden text-sm text-slate-500 md:block">
            Test how your application behaves when APIs go wrong.
          </p>
        </div>
      </div>
    </header>
  );
}
