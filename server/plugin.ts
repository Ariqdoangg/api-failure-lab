import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin, PreviewServer, ViteDevServer } from 'vite';
import { runSimulation, type SimulationRequest, type SimulationResult } from './simulationEngine.js';
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
    sendJson(res, 405, { error: 'Method not allowed. Use POST.' });
    return;
  }

  let payload: SimulationRequest;
  try {
    const raw = await readBody(req);
    payload = JSON.parse(raw) as SimulationRequest;
  } catch {
    sendJson(res, 400, { error: 'Invalid JSON request body.' });
    return;
  }

  try {
    const result: SimulationResult = await runSimulation(payload);
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

function attachMiddleware(server: ViteDevServer | PreviewServer): void {
  server.middlewares.use((req, res, next) => {
    if (req.method === 'POST' && isSimulateRequest(req)) {
      handleSimulate(req, res).catch(() => {
        if (!res.headersSent) sendJson(res, 500, { error: 'Simulation engine crashed.' });
      });
      return;
    }
    next();
  });
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
