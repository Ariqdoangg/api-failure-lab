import { validateTargetUrl, validateTargetUrlDns, ValidationError } from './validateUrl.js';

export type Scenario = 'normal' | '404' | '429' | '500' | 'slow';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH']);

export interface SimulationRequest {
  url: string;
  scenario: Scenario;
  delay: number;
  method: string;
  body?: unknown;
}

export interface SimulationResult {
  status: number;
  statusText: string;
  ok: boolean;
  durationMs: number;
  sizeBytes: number;
  headers: Record<string, string>;
  body: string;
  scenario: Scenario;
  simulated: boolean;
  endpoint: string;
  method: string;
  requestBody?: string;
  delay: number;
  error?: string;
}

const UPSTREAM_TIMEOUT_MS = 12_000;
const MAX_DELAY_MS = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScenario(value: unknown): value is Scenario {
  return value === 'normal' || value === '404' || value === '429' || value === '500' || value === 'slow';
}

function isJsonCompatible(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;

  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;

  seen.add(value);
  const values = Array.isArray(value) ? value : Object.values(value);
  const compatible = values.every((entry) => isJsonCompatible(entry, seen));
  seen.delete(value);
  return compatible;
}

export function decodeSimulationRequest(value: unknown): SimulationRequest {
  if (!isRecord(value)) {
    throw new ValidationError('Request body must be a JSON object.');
  }

  if (typeof value.url !== 'string' || value.url.trim() === '') {
    throw new ValidationError('url must be a non-empty string.');
  }

  if (typeof value.method !== 'string' || !ALLOWED_METHODS.has(value.method)) {
    throw new ValidationError(
      `Unsupported HTTP method: ${String(value.method)}. Allowed: GET, POST, PUT, PATCH, DELETE.`,
    );
  }

  if (!isScenario(value.scenario)) {
    throw new ValidationError(
      `Unsupported scenario: ${String(value.scenario)}. Allowed: normal, 404, 429, 500, slow.`,
    );
  }

  if (
    typeof value.delay !== 'number' ||
    !Number.isFinite(value.delay) ||
    value.delay < 0 ||
    value.delay > MAX_DELAY_MS
  ) {
    throw new ValidationError(`delay must be a finite number between 0 and ${MAX_DELAY_MS}.`);
  }

  if (value.body !== undefined && !isJsonCompatible(value.body)) {
    throw new ValidationError('body must be a JSON-compatible value.');
  }

  return {
    url: value.url,
    method: value.method,
    scenario: value.scenario,
    delay: value.delay,
    body: value.body,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampDelay(delay: number): number {
  const n = Number(delay);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.round(n), MAX_DELAY_MS);
}

function byteLength(str: string): number {
  return Buffer.byteLength(str, 'utf8');
}

function normalizeMethod(method: string): string {
  return (method || 'GET').toUpperCase();
}

function validateMethod(method: string): string {
  const normalized = normalizeMethod(method);
  if (!ALLOWED_METHODS.has(normalized)) {
    throw new ValidationError(`Unsupported HTTP method: ${method}. Allowed: GET, POST, PUT, PATCH, DELETE.`);
  }
  return normalized;
}

function buildBody(body: unknown, method: string): { bodyString: string | undefined; hasBody: boolean } {
  if (!BODY_METHODS.has(method)) {
    return { bodyString: undefined, hasBody: false };
  }
  if (body === undefined || body === null) {
    return { bodyString: undefined, hasBody: false };
  }
  if (typeof body === 'string') {
    if (body.trim() === '') return { bodyString: undefined, hasBody: false };
    return { bodyString: body, hasBody: true };
  }
  const bodyString = JSON.stringify(body);
  return { bodyString, hasBody: true };
}

async function fetchUpstream(
  url: string,
  method: string,
  bodyString: string | undefined,
  hasBody: boolean,
): Promise<{ status: number; statusText: string; headers: Record<string, string>; body: string; ok: boolean }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const init: RequestInit = { method, signal: controller.signal, redirect: 'follow' };
    if (hasBody && bodyString !== undefined) {
      init.headers = { 'content-type': 'application/json' };
      init.body = bodyString;
    }
    const res = await fetch(url, init);
    const text = await res.text();
    const headers: Record<string, string> = {};
    res.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    return {
      status: res.status,
      statusText: res.statusText || '',
      headers,
      body: text,
      ok: res.ok,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runSimulation(req: SimulationRequest): Promise<SimulationResult> {
  const request = decodeSimulationRequest(req);
  const scenario = request.scenario;
  const delay = clampDelay(request.delay);
  const endpoint = request.url.trim();
  const method = validateMethod(request.method);

  const validation = validateTargetUrl(endpoint);
  if (!validation.ok) {
    throw new ValidationError(validation.reason || 'Invalid URL.');
  }

  const { bodyString, hasBody } = buildBody(request.body, method);
  const requestBodyForResult = hasBody && bodyString ? bodyString : undefined;

  const start = performance.now();
  const elapsed = () => Math.round(performance.now() - start);

  if (scenario === '404') {
    await sleep(delay);
    const body = JSON.stringify({ error: 'Resource not found', simulated: true });
    return {
      status: 404,
      statusText: 'Not Found',
      ok: false,
      durationMs: elapsed(),
      sizeBytes: byteLength(body),
      headers: { 'content-type': 'application/json' },
      body,
      scenario,
      simulated: true,
      endpoint,
      method,
      requestBody: requestBodyForResult,
      delay,
    };
  }

  if (scenario === '429') {
    await sleep(delay);
    const retryAfter = Math.max(1, Math.ceil(delay / 1000) || 1);
    const body = JSON.stringify({ error: 'Too many requests', simulated: true });
    return {
      status: 429,
      statusText: 'Too Many Requests',
      ok: false,
      durationMs: elapsed(),
      sizeBytes: byteLength(body),
      headers: {
        'content-type': 'application/json',
        'retry-after': String(retryAfter),
      },
      body,
      scenario,
      simulated: true,
      endpoint,
      method,
      requestBody: requestBodyForResult,
      delay,
    };
  }

  if (scenario === '500') {
    await sleep(delay);
    const body = JSON.stringify({ error: 'Internal server error', simulated: true });
    return {
      status: 500,
      statusText: 'Internal Server Error',
      ok: false,
      durationMs: elapsed(),
      sizeBytes: byteLength(body),
      headers: { 'content-type': 'application/json' },
      body,
      scenario,
      simulated: true,
      endpoint,
      method,
      requestBody: requestBodyForResult,
      delay,
    };
  }

  // normal and slow both call the real upstream
  const dnsValidation = await validateTargetUrlDns(endpoint);
  if (!dnsValidation.ok) {
    throw new ValidationError(dnsValidation.reason || 'Invalid URL.');
  }

  try {
    const upstream = await fetchUpstream(endpoint, method, bodyString, hasBody);
    if (scenario === 'slow') {
      await sleep(delay);
    }
    return {
      status: upstream.status,
      statusText: upstream.statusText,
      ok: upstream.ok,
      durationMs: elapsed(),
      sizeBytes: byteLength(upstream.body),
      headers: upstream.headers,
      body: upstream.body,
      scenario,
      simulated: scenario === 'slow',
      endpoint,
      method,
      requestBody: requestBodyForResult,
      delay,
    };
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    return {
      status: 0,
      statusText: isTimeout ? 'Timeout' : 'Network Error',
      ok: false,
      durationMs: elapsed(),
      sizeBytes: 0,
      headers: {},
      body: '',
      scenario,
      simulated: false,
      endpoint,
      method,
      requestBody: requestBodyForResult,
      delay,
      error: isTimeout
        ? `Upstream request timed out after ${UPSTREAM_TIMEOUT_MS / 1000}s.`
        : `Failed to reach upstream: ${(err as Error).message}`,
    };
  }
}
