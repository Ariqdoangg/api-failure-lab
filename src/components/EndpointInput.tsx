import { Globe, ChevronDown } from 'lucide-react';
import type { HttpMethod } from '@/types';
import { useState, useRef, useEffect } from 'react';

interface EndpointInputProps {
  value: string;
  onChange: (value: string) => void;
  method: HttpMethod;
  onMethodChange: (method: HttpMethod) => void;
  disabled?: boolean;
  error?: string | null;
}

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'text-emerald-400',
  POST: 'text-blue-400',
  PUT: 'text-amber-400',
  PATCH: 'text-violet-400',
  DELETE: 'text-red-400',
};

export function EndpointInput({ value, onChange, method, onMethodChange, disabled, error }: EndpointInputProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div>
      <label htmlFor="endpoint" className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">
        API Endpoint
      </label>
      <div
        className={`flex items-stretch rounded-lg border bg-slate-900 transition-colors ${
          error ? 'border-red-500/60' : 'border-slate-700 focus-within:border-blue-500'
        }`}
      >
        <div className="relative flex items-center" ref={ref}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((prev) => !prev)}
            className="flex h-full items-center gap-1.5 rounded-l-lg border-r border-slate-700 bg-slate-800/60 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Select HTTP method"
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <span className={`font-mono ${METHOD_COLORS[method]}`}>{method}</span>
            <ChevronDown className={`h-3.5 w-3.5 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          </button>
          {open ? (
            <div
              className="absolute left-0 top-full z-20 mt-1 w-28 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl"
              role="listbox"
            >
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="option"
                  aria-selected={m === method}
                  disabled={disabled}
                  onClick={() => {
                    onMethodChange(m);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center px-3 py-1.5 text-left font-mono text-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed ${
                    m === method ? `${METHOD_COLORS[m]} bg-slate-800/60` : 'text-slate-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="relative flex-1">
          <Globe
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <input
            id="endpoint"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://api.example.com/v1/resource"
            className="w-full rounded-r-lg bg-transparent py-2.5 pl-10 pr-3 font-mono text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none disabled:opacity-50"
          />
        </div>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
