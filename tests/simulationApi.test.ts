import { once } from 'node:events';
import {
  createServer,
  request as sendHttpRequest,
  type IncomingHttpHeaders,
  type Server,
} from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { simulationMiddleware } from '../server/plugin.js';

const dnsLookup = vi.hoisted(() => vi.fn());

vi.mock('node:dns/promises', () => ({ lookup: dnsLookup }));

interface ApiResponse {
  status: number;
  headers: IncomingHttpHeaders;
  rawBody: string;
  body: unknown;
}

let server: Server;
let serverPort: number;

const upstreamFetch = vi.fn<typeof fetch>();

function requestApi(method: string, rawBody?: string): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const request = sendHttpRequest(
      {
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/simulate',
        method,
        headers:
          rawBody === undefined
            ? undefined
            : {
                'content-type': 'application/json',
                'content-length': Buffer.byteLength(rawBody),
              },
      },
      (response) => {
        response.setEncoding('utf8');
        let responseBody = '';
        response.on('data', (chunk: string) => {
          responseBody += chunk;
        });
        response.on('end', () => {
          resolve({
            status: response.statusCode || 0,
            headers: response.headers,
            rawBody: responseBody,
            body: JSON.parse(responseBody) as unknown,
          });
        });
      },
    );

    request.on('error', reject);
    if (rawBody !== undefined) request.write(rawBody);
    request.end();
  });
}

function postJson(value: unknown): Promise<ApiResponse> {
  return requestApi('POST', JSON.stringify(value));
}

beforeAll(async () => {
  server = createServer((request, response) => {
    simulationMiddleware(request, response, () => {
      response.statusCode = 404;
      response.end('Not found');
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test API did not bind to a TCP port.');
  }
  serverPort = address.port;
  vi.stubGlobal('fetch', upstreamFetch);
});

beforeEach(() => {
  upstreamFetch.mockReset();
  dnsLookup.mockReset();
  dnsLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
  upstreamFetch.mockResolvedValue(
    new Response(JSON.stringify({ source: 'local test upstream' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  );
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
    server.closeAllConnections?.();
  });
});

describe('POST /api/simulate request validation', () => {
  it('accepts a valid request envelope', async () => {
    const response = await postJson({
      url: 'https://upstream.test/resource',
      method: 'POST',
      scenario: '404',
      delay: 0,
      body: { value: 42, nested: [true, null, 'text'] },
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 404, scenario: '404', simulated: true });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON', async () => {
    const response = await requestApi('POST', '{"url":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Invalid JSON request body.' });
  });

  it('rejects a missing url', async () => {
    const response = await postJson({ method: 'GET', scenario: 'normal', delay: 0 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'url must be a non-empty string.' });
  });

  it('rejects an invalid simulation method', async () => {
    const response = await postJson({
      url: 'https://upstream.test/resource',
      method: 'TRACE',
      scenario: 'normal',
      delay: 0,
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: expect.stringContaining('Unsupported HTTP method') });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('rejects an unknown scenario without contacting upstream', async () => {
    const response = await postJson({
      url: 'https://upstream.test/must-not-be-contacted',
      method: 'GET',
      scenario: 'unknown',
      delay: 0,
    });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: expect.stringContaining('Unsupported scenario') });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('rejects a negative delay', async () => {
    const response = await postJson({
      url: 'https://upstream.test/resource',
      method: 'GET',
      scenario: 'normal',
      delay: -1,
    });

    expect(response.status).toBe(400);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('rejects a non-finite delay representable as a JSON number', async () => {
    const response = await requestApi(
      'POST',
      '{"url":"https://upstream.test/resource","method":"GET","scenario":"normal","delay":1e400}',
    );

    expect(response.status).toBe(400);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('rejects a delay above the supported UI range', async () => {
    const response = await postJson({
      url: 'https://upstream.test/resource',
      method: 'GET',
      scenario: 'normal',
      delay: 5001,
    });

    expect(response.status).toBe(400);
    expect(upstreamFetch).not.toHaveBeenCalled();
  });
});

describe('/api/simulate HTTP behavior', () => {
  it.each(['GET', 'PUT'])('returns 405 with Allow: POST for %s', async (method) => {
    const response = await requestApi(method);

    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe('POST');
    expect(response.body).toEqual({ error: 'Method not allowed. Use POST.' });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('keeps a normal happy-path POST functional', async () => {
    upstreamFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), {
        status: 201,
        statusText: 'Created',
        headers: { 'content-type': 'application/json' },
      }),
    );

    const response = await postJson({
      url: 'https://upstream.test/resource',
      method: 'GET',
      scenario: 'normal',
      delay: 5000,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      status: 201,
      statusText: 'Created',
      ok: true,
      scenario: 'normal',
      simulated: false,
      delay: 5000,
    });
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });
});
