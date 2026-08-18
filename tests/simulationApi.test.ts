import { once } from 'node:events';
import {
  createServer,
  request as sendHttpRequest,
  type IncomingHttpHeaders,
  type Server,
} from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MAX_SIMULATION_REQUEST_BODY_BYTES,
  simulationMiddleware,
} from '../server/plugin.js';

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
  return requestApiChunks(
    method,
    rawBody === undefined ? [] : [rawBody],
    rawBody === undefined
      ? undefined
      : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(rawBody) },
  );
}

function requestApiChunks(
  method: string,
  chunks: string[],
  headers?: Record<string, string | number>,
): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const request = sendHttpRequest(
      {
        hostname: '127.0.0.1',
        port: serverPort,
        path: '/api/simulate',
        method,
        headers,
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
    for (const chunk of chunks) request.write(chunk);
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

  it('accepts a valid request body exactly at the byte limit', async () => {
    const request = {
      url: 'https://upstream.test/resource',
      method: 'GET',
      scenario: '404',
      delay: 0,
      body: '',
    };
    const emptyBodyBytes = Buffer.byteLength(JSON.stringify(request));
    request.body = 'a'.repeat(MAX_SIMULATION_REQUEST_BODY_BYTES - emptyBodyBytes);
    const rawBody = JSON.stringify(request);
    expect(Buffer.byteLength(rawBody)).toBe(MAX_SIMULATION_REQUEST_BODY_BYTES);

    const response = await requestApi('POST', rawBody);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 404, scenario: '404', simulated: true });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('rejects an oversized declared Content-Length before reading the body', async () => {
    const response = await requestApiChunks('POST', ['{}'], {
      'content-type': 'application/json',
      'content-length': MAX_SIMULATION_REQUEST_BODY_BYTES + 1,
    });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: 'Request body too large.' });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('rejects a chunked request once its body crosses the byte limit', async () => {
    const response = await requestApiChunks(
      'POST',
      ['{"body":"', `${'a'.repeat(MAX_SIMULATION_REQUEST_BODY_BYTES)}"}`],
      { 'content-type': 'application/json' },
    );

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: 'Request body too large.' });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  it('counts multibyte request content by UTF-8 bytes', async () => {
    const rawBody = JSON.stringify({ value: '🚀'.repeat(70_000) });
    expect(rawBody.length).toBeLessThan(MAX_SIMULATION_REQUEST_BODY_BYTES);
    expect(Buffer.byteLength(rawBody)).toBeGreaterThan(MAX_SIMULATION_REQUEST_BODY_BYTES);

    const response = await requestApiChunks('POST', [rawBody], {
      'content-type': 'application/json',
    });

    expect(response.status).toBe(413);
    expect(response.body).toEqual({ error: 'Request body too large.' });
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
