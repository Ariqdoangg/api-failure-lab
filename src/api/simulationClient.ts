import type { SimulationRequest, SimulationResponse, ApiError } from '@/types';

const SIMULATE_TIMEOUT_MS = 20_000;

export async function runSimulation(req: SimulationRequest): Promise<SimulationResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SIMULATE_TIMEOUT_MS);
  try {
    const res = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message =
        (data && typeof data.error === 'string' && data.error) ||
        `Backend returned ${res.status} ${res.statusText}`.trim();
      const kind: ApiError['kind'] = res.status === 400 ? 'validation' : 'backend';
      return { error: { message, kind } };
    }

    if (!data || typeof data.status !== 'number') {
      return { error: { message: 'Backend returned an unexpected response shape.', kind: 'backend' } };
    }

    return { result: data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return {
        error: {
          message: `The simulation request timed out after ${SIMULATE_TIMEOUT_MS / 1000}s.`,
          kind: 'timeout',
        },
      };
    }
    if (err instanceof TypeError) {
      return {
        error: {
          message: 'Could not reach the simulation backend. It may be unavailable.',
          kind: 'network',
        },
      };
    }
    return {
      error: {
        message: `Unexpected error: ${(err as Error).message || 'unknown'}`,
        kind: 'unknown',
      },
    };
  } finally {
    clearTimeout(timer);
  }
}
