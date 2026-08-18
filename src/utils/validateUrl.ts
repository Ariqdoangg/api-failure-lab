export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'broadcasthost',
]);

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return false;
  }
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 224) return true;
  if (a === 240) return true;
  if (a === 255 && b === 255) return true;
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.startsWith('fe80')) return true;
  if (lower.startsWith('::ffff:')) {
    const v4 = lower.slice('::ffff:'.length);
    if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return isPrivateIPv4(v4);
  }
  return false;
}

function looksLikeIPv4(host: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

export function validateTargetUrl(raw: string): ValidationResult {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, reason: 'Enter a valid URL (e.g. https://example.com/api).' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only http and https URLs are allowed.' };
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: 'Requests to localhost are blocked to prevent SSRF.' };
  }

  if (looksLikeIPv4(host)) {
    if (isPrivateIPv4(host)) {
      return { ok: false, reason: 'Requests to private or loopback IP ranges are blocked to prevent SSRF.' };
    }
    return { ok: true };
  }

  if (host.includes(':') && isPrivateIPv6(host)) {
    return { ok: false, reason: 'Requests to private or loopback IPv6 ranges are blocked to prevent SSRF.' };
  }

  if (host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, reason: 'Requests to internal network hostnames are blocked to prevent SSRF.' };
  }

  return { ok: true };
}
