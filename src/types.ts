export type Scenario = 'normal' | '404' | '429' | '500' | 'slow';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface SimulationRequest {
  url: string;
  scenario: Scenario;
  delay: number;
  method: HttpMethod;
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
  method?: string;
  requestBody?: string;
  delay?: number;
  error?: string;
}

export interface ApiError {
  message: string;
  kind: 'validation' | 'network' | 'timeout' | 'backend' | 'unknown';
}

export interface SimulationResponse {
  result?: SimulationResult;
  error?: ApiError;
}
