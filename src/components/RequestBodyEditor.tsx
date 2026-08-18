import type { HttpMethod } from '@/types';
import { isBodyMethod } from '@/utils/requestBody';

interface RequestBodyEditorProps {
  method: HttpMethod;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string | null;
}

export function RequestBodyEditor({ method, value, onChange, disabled, error }: RequestBodyEditorProps) {
  if (!isBodyMethod(method)) return null;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Request Body</span>
        <span className="text-[10px] text-slate-600">JSON</span>
      </div>
      <div
        className={`overflow-hidden rounded-lg border bg-slate-950/40 transition-colors ${
          error ? 'border-red-500/60' : 'border-slate-700 focus-within:border-blue-500'
        }`}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          spellCheck={false}
          rows={8}
          placeholder='{ "key": "value" }'
          className="w-full resize-y bg-transparent p-3 font-mono text-xs leading-relaxed text-slate-200 placeholder:text-slate-600 focus:outline-none disabled:opacity-50"
          aria-label="Request body JSON editor"
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
