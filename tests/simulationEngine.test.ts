import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_UPSTREAM_RESPONSE_BODY_BYTES,
  runSimulation,
} from '../server/simulationEngine.js';
import { ValidationError } from '../server/validateUrl.js';

const dnsMocks = vi.hoisted(() => ({
  lookup: vi.fn(),
}));

vi.mock('node:dns/promises', () => dnsMocks);

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

  if (!target.hostname.endsWith('.test')) {
    throw new Error(`Unexpected test upstream: ${target.hostname}`);
  }

  const targetPath = target.pathname;
  target.protocol = 'http:';
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

    if (request.url === '/small-response') {
      const responseBody = JSON.stringify({ ok: true });
      response.writeHead(200, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(responseBody),
      });
      response.end(responseBody);
      return;
    }

    if (request.url === '/max-size-response') {
      response.writeHead(200, {
        'content-type': 'text/plain',
        'content-length': MAX_UPSTREAM_RESPONSE_BODY_BYTES,
      });
      response.end(Buffer.alloc(MAX_UPSTREAM_RESPONSE_BODY_BYTES, 97));
      return;
    }

    if (request.url === '/oversized-declared') {
      response.writeHead(200, {
        'content-type': 'text/plain',
        'content-length': MAX_UPSTREAM_RESPONSE_BODY_BYTES + 1,
      });
      response.end('not read');
      return;
    }

    if (request.url === '/oversized-chunked') {
      response.writeHead(200, { 'content-type': 'text/plain' });
      response.write(Buffer.alloc(MAX_UPSTREAM_RESPONSE_BODY_BYTES, 97));
      response.end('b');
      return;
    }

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

    const redirectLocations: Record<string, string> = {
      '/redirect-public': 'https://public-target.test/final',
      '/redirect-relative': '../final?from=relative',
      '/redirect-localhost': 'http://localhost/secret',
      '/redirect-private-v4': 'http://10.20.30.40/secret',
      '/redirect-private-v6': 'http://[fd12:3456:789a::1]/secret',
      '/redirect-private-dns': 'https://private-address.test/secret',
      '/redirect-chain': 'https://hop-one.test/redirect-chain-two',
      '/redirect-chain-two': 'https://hop-two.test/final',
      '/redirect-loop-a': '/redirect-loop-b',
      '/redirect-loop-b': '/redirect-loop-a',
    };
    const redirectLocation = request.url ? redirectLocations[request.url] : undefined;
    if (redirectLocation) {
      response.writeHead(302, { location: redirectLocation });
      response.end();
      return;
    }

    if (request.url === '/redirect-without-location') {
      response.writeHead(302, { 'content-type': 'text/plain' });
      response.end('redirect destination missing');
      return;
    }

    const excessiveRedirect = request.url?.match(/^\/redirect-excessive\/(\d+)$/);
    if (excessiveRedirect) {
      const nextHop = Number(excessiveRedirect[1]) + 1;
      response.writeHead(302, { location: `/redirect-excessive/${nextHop}` });
      response.end();
      return;
    }

    const semanticRedirect = request.url?.match(/^\/redirect-(301|302|303|307|308)$/);
    if (semanticRedirect) {
      response.writeHead(Number(semanticRedirect[1]), { location: '/redirect-method-target' });
      response.end();
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
  dnsMocks.lookup.mockReset();
  dnsMocks.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
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
  it('preserves a small declared upstream response', async () => {
    const result = await runSimulation({
      url: `${upstreamOrigin}/small-response`,
      scenario: 'normal',
      delay: 0,
      method: 'GET',
    });

    expect(result).toMatchObject({
      status: 200,
      ok: true,
      body: JSON.stringify({ ok: true }),
      sizeBytes: Buffer.byteLength(JSON.stringify({ ok: true })),
    });
  });

  it('accepts an upstream response exactly at the byte limit', async () => {
    const result = await runSimulation({
      url: `${upstreamOrigin}/max-size-response`,
      scenario: 'normal',
      delay: 0,
      method: 'GET',
    });

    expect(result.status).toBe(200);
    expect(result.sizeBytes).toBe(MAX_UPSTREAM_RESPONSE_BODY_BYTES);
    expect(Buffer.byteLength(result.body)).toBe(MAX_UPSTREAM_RESPONSE_BODY_BYTES);
  });

  it('rejects an upstream response with an oversized declared Content-Length', async () => {
    const result = await runSimulation({
      url: `${upstreamOrigin}/oversized-declared`,
      scenario: 'normal',
      delay: 0,
      method: 'GET',
    });

    expect(result).toMatchObject({
      status: 0,
      body: '',
      sizeBytes: 0,
      error: `Upstream response body exceeds the ${MAX_UPSTREAM_RESPONSE_BODY_BYTES}-byte limit.`,
    });
  });

  it('rejects a chunked upstream response once it crosses the byte limit', async () => {
    const result = await runSimulation({
      url: `${upstreamOrigin}/oversized-chunked`,
      scenario: 'normal',
      delay: 0,
      method: 'GET',
    });

    expect(result).toMatchObject({
      status: 0,
      body: '',
      sizeBytes: 0,
      error: `Upstream response body exceeds the ${MAX_UPSTREAM_RESPONSE_BODY_BYTES}-byte limit.`,
    });
  });

  it('rejects a hostname resolving to a non-public address before fetch', async () => {
    dnsMocks.lookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }]);

    await expect(
      runSimulation({
        url: `${upstreamOrigin}/echo`,
        scenario: 'normal',
        delay: 0,
        method: 'GET',
      }),
    ).rejects.toThrow(ValidationError);
    expect(fetchBridge).not.toHaveBeenCalled();
  });

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

  it('follows a public redirect after validating its destination', async () => {
    const result = await runSimulation({
      url: `${upstreamOrigin}/redirect-public`,
      scenario: 'normal',
      delay: 0,
      method: 'GET',
    });

    expect(result).toMatchObject({ status: 200, ok: true });
    expect(observedRequests.map(({ path }) => path)).toEqual(['/redirect-public', '/final']);
    expect(dnsMocks.lookup).toHaveBeenCalledWith('public-target.test', {
      all: true,
      verbatim: true,
    });
    expect(fetchBridge).toHaveBeenCalledTimes(2);
    expect(fetchBridge.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
    expect(fetchBridge.mock.calls[1][1]).toMatchObject({ redirect: 'manual' });
  });

  it('resolves and follows a relative redirect', async () => {
    const result = await runSimulation({
      url: `${upstreamOrigin}/nested/../redirect-relative`,
      scenario: 'normal',
      delay: 0,
      method: 'GET',
    });

    expect(result.status).toBe(200);
    expect(observedRequests.map(({ path }) => path)).toEqual([
      '/redirect-relative',
      '/final?from=relative',
    ]);
  });

  it.each([
    ['/redirect-localhost', 'localhost'],
    ['/redirect-private-v4', 'private IPv4'],
    ['/redirect-private-v6', 'private IPv6'],
  ])('blocks a public redirect to %s (%s)', async (path) => {
    await expect(
      runSimulation({
        url: `${upstreamOrigin}${path}`,
        scenario: 'normal',
        delay: 0,
        method: 'GET',
      }),
    ).rejects.toThrow(ValidationError);

    expect(fetchBridge).toHaveBeenCalledTimes(1);
    expect(observedRequests.map(({ path: requestPath }) => requestPath)).toEqual([path]);
  });

  it('blocks a redirect hostname that resolves to a private address', async () => {
    dnsMocks.lookup.mockImplementation(async (hostname: string) => [
      {
        address: hostname === 'private-address.test' ? '192.168.10.20' : '93.184.216.34',
        family: 4,
      },
    ]);

    await expect(
      runSimulation({
        url: `${upstreamOrigin}/redirect-private-dns`,
        scenario: 'normal',
        delay: 0,
        method: 'GET',
      }),
    ).rejects.toThrow(ValidationError);

    expect(dnsMocks.lookup).toHaveBeenCalledWith('private-address.test', {
      all: true,
      verbatim: true,
    });
    expect(fetchBridge).toHaveBeenCalledTimes(1);
  });

  it('validates DNS and IP policy at every redirect hop', async () => {
    const result = await runSimulation({
      url: `${upstreamOrigin}/redirect-chain`,
      scenario: 'normal',
      delay: 0,
      method: 'GET',
    });

    expect(result.status).toBe(200);
    expect(dnsMocks.lookup.mock.calls.map(([hostname]) => hostname)).toEqual([
      'upstream.test',
      'hop-one.test',
      'hop-two.test',
    ]);
    expect(observedRequests.map(({ path }) => path)).toEqual([
      '/redirect-chain',
      '/redirect-chain-two',
      '/final',
    ]);
  });

  it('rejects redirect chains that exceed the explicit limit', async () => {
    await expect(
      runSimulation({
        url: `${upstreamOrigin}/redirect-excessive/0`,
        scenario: 'normal',
        delay: 0,
        method: 'GET',
      }),
    ).rejects.toThrow('Upstream exceeded the limit of 5 redirects.');

    expect(fetchBridge).toHaveBeenCalledTimes(6);
    expect(observedRequests).toHaveLength(6);
  });

  it('rejects redirect loops', async () => {
    await expect(
      runSimulation({
        url: `${upstreamOrigin}/redirect-loop-a`,
        scenario: 'normal',
        delay: 0,
        method: 'GET',
      }),
    ).rejects.toThrow('Upstream redirect loop detected.');

    expect(fetchBridge).toHaveBeenCalledTimes(2);
  });

  it('returns a redirect response without Location as the final response', async () => {
    const result = await runSimulation({
      url: `${upstreamOrigin}/redirect-without-location`,
      scenario: 'normal',
      delay: 0,
      method: 'GET',
    });

    expect(result).toMatchObject({
      status: 302,
      ok: false,
      body: 'redirect destination missing',
    });
    expect(fetchBridge).toHaveBeenCalledTimes(1);
  });

  it.each([
    [301, 'POST', 'GET', false],
    [302, 'POST', 'GET', false],
    [303, 'PUT', 'GET', false],
    [307, 'POST', 'POST', true],
    [308, 'PATCH', 'PATCH', true],
  ] as const)(
    'applies fetch redirect semantics for %s after %s',
    async (status, method, redirectedMethod, preservesBody) => {
      const body = { redirect: status };
      const result = await runSimulation({
        url: `${upstreamOrigin}/redirect-${status}`,
        scenario: 'normal',
        delay: 0,
        method,
        body,
      });

      expect(result.status).toBe(200);
      expect(observedRequests).toHaveLength(2);
      expect(observedRequests[1]).toMatchObject({
        method: redirectedMethod,
        path: '/redirect-method-target',
        body: preservesBody ? JSON.stringify(body) : '',
      });
      expect(observedRequests[1].contentType).toBe(
        preservesBody ? 'application/json' : undefined,
      );
    },
  );

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
    expect(dnsMocks.lookup).not.toHaveBeenCalled();
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
