import { useCallback, useState } from 'react';
import { Header } from '@/components/Header';
import { RequestConfig } from '@/components/RequestConfig';
import { ResponseInspector } from '@/components/ResponseInspector';
import { RequestHistory } from '@/components/RequestHistory';
import { LatencyAnalytics } from '@/components/LatencyAnalytics';
import { runSimulation } from '@/api/simulationClient';
import { validateTargetUrl } from '@/utils/validateUrl';
import { useRequestHistory } from '@/hooks/useRequestHistory';
import { DEFAULT_BODY, isBodyMethod } from '@/components/RequestBodyEditor';
import { tryParseJson } from '@/utils/format';
import type { Scenario, HttpMethod, SimulationResult, ApiError } from '@/types';

const DEFAULT_URL = 'https://jsonplaceholder.typicode.com/users';
const DEFAULT_METHOD: HttpMethod = 'GET';
const DEFAULT_SCENARIO: Scenario = 'normal';
const DEFAULT_DELAY = 0;
const SLOW_DEFAULT_DELAY = 2000;

export default function App() {
  const [url, setUrl] = useState<string>(DEFAULT_URL);
  const [method, setMethod] = useState<HttpMethod>(DEFAULT_METHOD);
  const [scenario, setScenario] = useState<Scenario>(DEFAULT_SCENARIO);
  const [delay, setDelay] = useState<number>(DEFAULT_DELAY);
  const [body, setBody] = useState<string>(DEFAULT_BODY);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [bodyError, setBodyError] = useState<string | null>(null);
  const [isHistorical, setIsHistorical] = useState<boolean>(false);

  const { history, selectedId, addEntry, clearHistory, selectEntry } = useRequestHistory();

  const handleScenarioChange = useCallback((next: Scenario) => {
    setScenario((prev) => {
      if (prev !== 'slow' && next === 'slow') {
        setDelay(SLOW_DEFAULT_DELAY);
      }
      if (prev === 'slow' && next !== 'slow') {
        setDelay(DEFAULT_DELAY);
      }
      return next;
    });
  }, []);

  const handleRun = useCallback(async () => {
    setUrlError(null);
    setBodyError(null);
    const trimmed = url.trim();
    if (!trimmed) {
      setUrlError('Enter an API endpoint URL.');
      return;
    }
    const validation = validateTargetUrl(trimmed);
    if (!validation.ok) {
      setUrlError(validation.reason || 'Invalid URL.');
      return;
    }

    let parsedBody: unknown | undefined;
    if (isBodyMethod(method)) {
      const trimmedBody = body.trim();
      if (trimmedBody !== '') {
        const parsed = tryParseJson(trimmedBody);
        if (parsed === null) {
          setBodyError('Invalid JSON. Check the request body before running the simulation.');
          return;
        }
        parsedBody = parsed.parsed;
      }
    }

    setIsRunning(true);
    setError(null);
    setResult(null);
    setIsHistorical(false);

    const response = await runSimulation({ url: trimmed, scenario, delay, method, body: parsedBody });

    if (response.error) {
      setError(response.error);
    } else if (response.result) {
      setResult(response.result);
      addEntry(response.result, method);
    }
    setIsRunning(false);
  }, [url, scenario, delay, method, body, addEntry]);

  const handleReset = useCallback(() => {
    setUrl(DEFAULT_URL);
    setMethod(DEFAULT_METHOD);
    setScenario(DEFAULT_SCENARIO);
    setDelay(DEFAULT_DELAY);
    setBody(DEFAULT_BODY);
    setResult(null);
    setError(null);
    setUrlError(null);
    setBodyError(null);
    setIsHistorical(false);
    selectEntry(null);
  }, [selectEntry]);

  const handleSelectHistory = useCallback(
    (id: string) => {
      const entry = history.find((h) => h.id === id);
      if (!entry) return;
      setError(null);
      setResult(entry.result);
      setIsHistorical(true);
      selectEntry(id);
    },
    [history, selectEntry],
  );

  const handleClearHistory = useCallback(() => {
    clearHistory();
    if (isHistorical) {
      setResult(null);
      setIsHistorical(false);
    }
  }, [clearHistory, isHistorical]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <RequestConfig
            url={url}
            method={method}
            scenario={scenario}
            delay={delay}
            body={body}
            isRunning={isRunning}
            urlError={urlError}
            bodyError={bodyError}
            onUrlChange={setUrl}
            onMethodChange={setMethod}
            onScenarioChange={handleScenarioChange}
            onDelayChange={setDelay}
            onBodyChange={setBody}
            onRun={handleRun}
            onReset={handleReset}
          />
          <ResponseInspector
            result={result}
            error={error}
            isRunning={isRunning}
            isHistorical={isHistorical}
          />
        </div>
        <div className="mt-6 space-y-6">
          <LatencyAnalytics history={history} />
          <RequestHistory
            history={history}
            selectedId={selectedId}
            onSelect={handleSelectHistory}
            onClear={handleClearHistory}
          />
        </div>
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <p className="text-center text-[11px] text-slate-600">
          API Failure Lab v0.4 — Simulated responses are generated server-side. Normal &amp; Slow scenarios call the real target API.
        </p>
      </footer>
    </div>
  );
}
