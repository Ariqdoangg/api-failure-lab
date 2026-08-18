import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import {
  decodeSimulationRequest,
  runSimulation,
  type SimulationResult,
} from './simulationEngine.js';
import { ValidationError } from './validateUrl.js';

export const MAX_SIMULATION_REQUEST_BODY_BYTES = 256 * 1024;

class PayloadTooLargeError extends Error {}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function declaredContentLength(req: IncomingMessage): bigint | undefined {
  const value = req.headers['content-length'];
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return undefined;
  return BigInt(value);
}

function readBody(req: IncomingMessage): Promise<string> {
  const contentLength = declaredContentLength(req);
  if (
    contentLength !== undefined &&
    contentLength > BigInt(MAX_SIMULATION_REQUEST_BODY_BYTES)
  ) {
    req.pause();
    return Promise.reject(new PayloadTooLargeError('Request body too large.'));
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let sizeBytes = 0;
    let settled = false;

    const cleanup = () => {
      req.removeListener('data', onData);
      req.removeListener('end', onEnd);
      req.removeListener('aborted', onAborted);
      req.removeListener('error', onError);
    };
    const onData = (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      sizeBytes += buffer.byteLength;
      if (sizeBytes > MAX_SIMULATION_REQUEST_BODY_BYTES) {
        settled = true;
        chunks.length = 0;
        cleanup();
        req.pause();
        reject(new PayloadTooLargeError('Request body too large.'));
        return;
      }
      chunks.push(buffer);
    };
    const onEnd = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(Buffer.concat(chunks, sizeBytes).toString('utf8'));
    };
    const onAborted = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Request body was aborted.'));
    };
    const onError = (error: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    req.on('data', onData);
    req.once('end', onEnd);
    req.once('aborted', onAborted);
    req.once('error', onError);
  });
}

async function handleSimulate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    return;
  }

  let payload: unknown;
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw) as unknown;
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      res.setHeader('connection', 'close');
      sendJson(res, 413, { error: 'Request body too large.' });
      return;
    }
    sendJson(res, 400, { error: 'Invalid JSON request body.' });
    return;
  }

  try {
    const request = decodeSimulationRequest(payload);
    const result: SimulationResult = await runSimulation(request);
    sendJson(res, 200, result);
  } catch (err) {
    if (err instanceof ValidationError) {
      sendJson(res, 400, { error: err.message });
      return;
    }
    sendJson(res, 500, { error: 'Simulation engine failed unexpectedly.' });
  }
}

function isSimulateRequest(req: IncomingMessage): boolean {
  const url = (req.url || '') as string;
  return url === '/api/simulate' || url.startsWith('/api/simulate?');
}

export function simulationMiddleware(
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void {
  if (!isSimulateRequest(req)) {
    next();
    return;
  }

  handleSimulate(req, res).catch(() => {
    if (!res.headersSent) sendJson(res, 500, { error: 'Simulation engine crashed.' });
  });
}

function attachMiddleware(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use(simulationMiddleware);
}

export function simulationPlugin(): Plugin {
  return {
    name: 'api-failure-lab-simulate',
    configureServer(server) {
      attachMiddleware(server);
    },
    configurePreviewServer(server) {
      attachMiddleware(server);
    },
  };
}
