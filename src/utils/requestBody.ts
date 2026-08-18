import type { HttpMethod } from '@/types';

export const DEFAULT_BODY = `{
  "title": "API Failure Lab",
  "status": "testing"
}`;

const BODY_METHODS: readonly HttpMethod[] = ['POST', 'PUT', 'PATCH'];

export function isBodyMethod(method: HttpMethod): boolean {
  return BODY_METHODS.includes(method);
}
