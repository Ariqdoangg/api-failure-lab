import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import {
  decodeSimulationRequest,
  runSimulation,
  type SimulationResult,
} from './simulationEngine.js';
import { ValidationError } from './validateUrl.js';

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => {
      data += chunk.toString();
      if (data.length > 256 * 1024) {
        req.destroy();
        reject(new Error('Request body too large.'));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
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
  } catch {
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
