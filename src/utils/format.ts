export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return `${Math.round(ms).toLocaleString('en-US')} ms`;
}

export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function statusTone(status: number): 'success' | 'warning' | 'error' | 'neutral' {
  if (status === 0) return 'error';
  if (status >= 200 && status < 300) return 'success';
  if (status >= 300 && status < 400) return 'warning';
  if (status >= 400 && status < 500) return 'warning';
  if (status >= 500) return 'error';
  return 'neutral';
}

export function statusLabel(status: number, statusText: string): string {
  if (status === 0) return statusText || 'No Response';
  const text = statusText || '';
  return text ? `${status} ${text}` : `${status}`;
}

export function scenarioLabel(scenario: string, simulated: boolean): string {
  switch (scenario) {
    case 'normal':
      return 'Normal Request';
    case '404':
      return simulated ? 'Simulated 404 Error' : '404 Error';
    case '429':
      return simulated ? 'Simulated 429 Error' : '429 Error';
    case '500':
      return simulated ? 'Simulated 500 Error' : '500 Error';
    case 'slow':
      return simulated ? 'Slow Response (Simulated Delay)' : 'Slow Response';
    default:
      return scenario;
  }
}

export function tryParseJson(body: string): { parsed: unknown } | null {
  if (!body) return null;
  try {
    return { parsed: JSON.parse(body) };
  } catch {
    return null;
  }
}

export function prettyPrintJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
