import { useState } from 'react';
import { Copy, Check, FileJson, AlignLeft, FileCode } from 'lucide-react';
import type { SimulationResult } from '@/types';
import { tryParseJson, prettyPrintJson } from '@/utils/format';

interface ResponseViewerProps {
  result: SimulationResult;
}

type Tab = 'body' | 'headers' | 'request';

export function ResponseViewer({ result }: ResponseViewerProps) {
  const [tab, setTab] = useState<Tab>('body');
  const [copied, setCopied] = useState(false);

  const parsed = tryParseJson(result.body);
  const isJson = parsed !== null;
  const displayBody = isJson ? prettyPrintJson(parsed!.parsed) : result.body;

  const headerEntries = Object.entries(result.headers).sort((a, b) => a[0].localeCompare(b[0]));

  const hasRequestBody = Boolean(result.requestBody);
  const requestParsed = hasRequestBody ? tryParseJson(result.requestBody!) : null;
  const displayRequestBody =
    hasRequestBody && requestParsed ? prettyPrintJson(requestParsed!.parsed) : result.requestBody || '';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayBody || '');
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable; no-op
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950/40">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/40">
        <div className="flex" role="tablist" aria-label="Response viewer tabs">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'body'}
            onClick={() => setTab('body')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium transition-colors ${
              tab === 'body'
                ? 'border-b-2 border-blue-500 text-white'
                : 'border-b-2 border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            {isJson ? <FileJson className="h-3.5 w-3.5" aria-hidden="true" /> : <AlignLeft className="h-3.5 w-3.5" aria-hidden="true" />}
            Body
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'headers'}
            onClick={() => setTab('headers')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium transition-colors ${
              tab === 'headers'
                ? 'border-b-2 border-blue-500 text-white'
                : 'border-b-2 border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Headers
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">{headerEntries.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'request'}
            onClick={() => setTab('request')}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium transition-colors ${
              tab === 'request'
                ? 'border-b-2 border-blue-500 text-white'
                : 'border-b-2 border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileCode className="h-3.5 w-3.5" aria-hidden="true" />
            Request
          </button>
        </div>
        {tab === 'body' && displayBody ? (
          <button
            type="button"
            onClick={handleCopy}
            className="mr-2 inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:text-white"
            aria-label="Copy response body"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        ) : null}
      </div>

      <div className="max-h-[420px] overflow-auto scrollbar-thin">
        {tab === 'body' ? (
          displayBody ? (
            <pre className="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed text-slate-300">
              {displayBody}
            </pre>
          ) : (
            <div className="p-4 text-xs text-slate-500">No response body.</div>
          )
        ) : tab === 'headers' ? (
          headerEntries.length > 0 ? (
            <table className="w-full border-collapse text-xs">
              <tbody>
                {headerEntries.map(([key, value]) => (
                  <tr key={key} className="border-b border-slate-800/60 last:border-0">
                    <td className="w-1/3 whitespace-nowrap px-4 py-2 font-mono text-slate-400">{key}</td>
                    <td className="break-all px-4 py-2 font-mono text-slate-200">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-4 text-xs text-slate-500">No response headers.</div>
          )
        ) : (
          <div className="space-y-3 p-4">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Method</div>
              <div className="mt-0.5 font-mono text-sm text-slate-200">{result.method || 'GET'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Endpoint</div>
              <div className="mt-0.5 break-all font-mono text-xs text-slate-300">{result.endpoint || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Request Body</div>
              {hasRequestBody ? (
                <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words rounded-md border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs leading-relaxed text-slate-300">
                  {displayRequestBody}
                </pre>
              ) : (
                <div className="mt-1 text-xs text-slate-500">No request body</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
