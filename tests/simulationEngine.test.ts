import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { runSimulation } from '../server/simulationEngine.js';
import { ValidationError } from '../server/validateUrl.js';

interface ObservedRequest {
  method: string;
  path: string;
  contentType?: string;
  body: string;
}

const upstreamOrigin = 'http://upstream.test';
const bodyMethods = new Set(['POST', 'PUT', 'PATCH']);
const realFetch = globalThis.fetch;

let server: Server;
let serverPort: number;
let observedRequests: ObservedRequest[] = [];
let slowUpstreamResponseObserved = false;

const fetchBridge = vi.fn<typeof fetch>(async (input, init) => {
  const target = new URL(
    typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
  );

  if (target.hostname !== 'upstream.test') {
    throw new Error(`Unexpected test upstream: ${target.hostname}`);
  }

  const targetPath = target.pathname;
  target.hostname = '127.0.0.1';
  target.port = String(serverPort);
  const response = await realFetch(target, init);
  if (targetPath === '/slow-ordering') {
    slowUpstreamResponseObserved = true;
  }
  return response;
});

beforeAll(async () => {
  server = createServer(async (request, response) => {
    request.setEncoding('utf8');
    let body = '';
    for await (const chunk of request) {
      body += chunk;
    }

    observedRequests.push({
      method: request.method || '',
      path: request.url || '',
      contentType: request.headers['content-type'],
      body,
    });
    response.setHeader('connection', 'close');

    if (request.url === '/non-2xx') {
      response.writeHead(422, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'upstream rejected request' }));
      return;
    }

    if (request.url === '/non-json') {
      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('plain upstream response');
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(
      JSON.stringify({
        method: request.method,
        body: body ? JSON.parse(body) : null,
      }),
    );
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test upstream did not bind to a TCP port.');
  }
  serverPort = address.port;
  vi.stubGlobal('fetch', fetchBridge);
});

beforeEach(() => {
  observedRequests = [];
  slowUpstreamResponseObserved = false;
  fetchBridge.mockClear();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    if (typeof server.closeIdleConnections === 'function') {
      server.closeIdleConnections();
    }
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
  });
});

describe('runSimulation upstream requests', () => {
  it.each(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])('forwards %s requests', async (method) => {
    const requestBody = bodyMethods.has(method) ? { method, value: 42 } : undefined;
    const result = await runSimulation({
      url: `${upstreamOrigin}/echo`,
      scenario: 'normal',
      delay: 0,
      method,
      body: requestBody,
    });

    expect(result).toMatchObject({
      status: 200,
      ok: true,
      scenario: 'normal',
      simulated: false,
      method,
    });
    expect(observedRequests).toHaveLength(1);
    expect(observedRequests[0]).toMatchObject({ method, path: '/echo' });

    if (requestBody) {
      expect(observedRequests[0].contentType).toBe('application/json');
      expect(JSON.parse(observedRequests[0].body)).toEqual(requestBody);
      expect(result.requestBody).toBe(JSON.stringify(requestBody));
    } else {
      expect(observedRequests[0].body).toBe('');
      expect(result.requestBody).toBeUndefined();
    }
  });

  it('preserves a real non-2xx upstream response', async () => {
    const result = await runSimulation({
      url: `${upstreamOrigin}/non-2xx`,
      scenario: 'normal',
      delay: 0,
      method: 'GET',
    });

    expect(result).toMatchObject({
      status: 422,
      statusText: 'Unprocessable Entity',
      ok: false,
      body: JSON.stringify({ error: 'upstream rejected request' }),
      simulated: false,
    });
  });

  it('preserves a non-JSON upstream response', async () => {
    const result = await runSimulation({
      url: `${upstreamOrigin}/non-json`,
      scenario: 'normal',
      delay: 0,
      method: 'GET',
    });

    expect(result.status).toBe(200);
    expect(result.body).toBe('plain upstream response');
    expect(result.headers['content-type']).toContain('text/plain');
    expect(result.sizeBytes).toBe(Buffer.byteLength('plain upstream response', 'utf8'));
  });

  it('adds the configured Slow Response delay after contacting upstream', async () => {
    const slowDelayMs = 35;
    const originalSetTimeout = globalThis.setTimeout;
    let delayScheduledAfterUpstream = false;
    let delayCompleted = false;
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    timeoutSpy.mockImplementation(
      ((...args: Parameters<typeof setTimeout>) => {
        const [callback, delay, ...callbackArgs] = args;
        if (delay === slowDelayMs) {
          delayScheduledAfterUpstream = slowUpstreamResponseObserved;
          return originalSetTimeout(() => {
            delayCompleted = true;
            Reflect.apply(callback, undefined, callbackArgs);
          }, delay);
        }
        return Reflect.apply(originalSetTimeout, globalThis, args);
      }) as typeof setTimeout,
    );

    let result;
    try {
      result = await runSimulation({
        url: `${upstreamOrigin}/slow-ordering`,
        scenario: 'slow',
        delay: slowDelayMs,
        method: 'GET',
      });
    } finally {
      timeoutSpy.mockRestore();
    }

    expect(observedRequests).toHaveLength(1);
    expect(slowUpstreamResponseObserved).toBe(true);
    expect(delayScheduledAfterUpstream).toBe(true);
    expect(delayCompleted).toBe(true);
    expect(result).toMatchObject({ status: 200, scenario: 'slow', simulated: true, delay: slowDelayMs });
    expect(result.durationMs).toBeGreaterThanOrEqual(25);
  });
});

describe('runSimulation local scenarios', () => {
  it.each([
    ['404', 404, 'Not Found'],
    ['429', 429, 'Too Many Requests'],
    ['500', 500, 'Internal Server Error'],
  ] as const)('returns simulated %s without contacting upstream', async (scenario, status, statusText) => {
    const result = await runSimulation({
      url: `${upstreamOrigin}/must-not-be-contacted`,
      scenario,
      delay: 0,
      method: 'POST',
      body: { local: true },
    });

    expect(result).toMatchObject({ status, statusText, ok: false, scenario, simulated: true });
    expect(fetchBridge).not.toHaveBeenCalled();
    expect(observedRequests).toHaveLength(0);
  });

  it('rejects unsupported HTTP methods', async () => {
    await expect(
      runSimulation({
        url: `${upstreamOrigin}/echo`,
        scenario: 'normal',
        delay: 0,
        method: 'TRACE',
      }),
    ).rejects.toThrow(ValidationError);
    expect(fetchBridge).not.toHaveBeenCalled();
  });
});
