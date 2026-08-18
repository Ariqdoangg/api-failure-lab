import { isIP } from 'node:net';
import { lookup } from 'node:dns/promises';

export interface ValidationResult {
  ok: boolean;
  reason?: string;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'ip6-localhost',
  'ip6-loopback',
  'broadcasthost',
]);

interface Ipv4Range {
  network: number;
  prefixLength: number;
}

const NON_PUBLIC_IPV4_RANGES: Ipv4Range[] = [
  { network: 0x00000000, prefixLength: 8 }, // Current network
  { network: 0x0a000000, prefixLength: 8 }, // Private use
  { network: 0x64400000, prefixLength: 10 }, // Carrier-grade NAT
  { network: 0x7f000000, prefixLength: 8 }, // Loopback
  { network: 0xa9fe0000, prefixLength: 16 }, // Link-local
  { network: 0xac100000, prefixLength: 12 }, // Private use
  { network: 0xc0000000, prefixLength: 24 }, // IETF protocol assignments
  { network: 0xc0000200, prefixLength: 24 }, // Documentation
  { network: 0xc0586300, prefixLength: 24 }, // Deprecated 6to4 relay anycast
  { network: 0xc0a80000, prefixLength: 16 }, // Private use
  { network: 0xc6120000, prefixLength: 15 }, // Benchmarking
  { network: 0xc6336400, prefixLength: 24 }, // Documentation
  { network: 0xcb007100, prefixLength: 24 }, // Documentation
  { network: 0xe0000000, prefixLength: 4 }, // Multicast
  { network: 0xf0000000, prefixLength: 4 }, // Reserved and limited broadcast
];

const PUBLIC_IPV4_EXCEPTIONS = new Set([
  '192.0.0.9', // Port Control Protocol anycast
  '192.0.0.10', // Traversal Using Relays around NAT anycast
]);

function parseIPv4(ip: string): number | undefined {
  if (isIP(ip) !== 4) return undefined;

  return ip
    .split('.')
    .map(Number)
    .reduce((value, part) => ((value << 8) | part) >>> 0, 0);
}

function isIpv4InRange(address: number, { network, prefixLength }: Ipv4Range): boolean {
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (address & mask) >>> 0 === (network & mask) >>> 0;
}

function isNonPublicIPv4(ip: string): boolean {
  const address = parseIPv4(ip);
  return (
    address !== undefined &&
    !PUBLIC_IPV4_EXCEPTIONS.has(ip) &&
    NON_PUBLIC_IPV4_RANGES.some((range) => isIpv4InRange(address, range))
  );
}

function parseIPv6(ip: string): number[] | undefined {
  if (isIP(ip) !== 6) return undefined;

  let normalized = ip.toLowerCase();
  const lastColon = normalized.lastIndexOf(':');
  const ipv4Tail = normalized.slice(lastColon + 1);
  const ipv4 = parseIPv4(ipv4Tail);
  if (ipv4 !== undefined) {
    normalized = `${normalized.slice(0, lastColon + 1)}${(ipv4 >>> 16).toString(16)}:${(
      ipv4 & 0xffff
    ).toString(16)}`;
  }

  const halves = normalized.split('::');
  if (halves.length > 2) return undefined;

  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) {
    return undefined;
  }

  return [
    ...left.map((part) => Number.parseInt(part, 16)),
    ...Array<number>(missing).fill(0),
    ...right.map((part) => Number.parseInt(part, 16)),
  ];
}

function isNonPublicIPv6(ip: string): boolean {
  const words = parseIPv6(ip);
  if (!words) return false;

  const isIpv4Mapped = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  if (isIpv4Mapped) {
    const ipv4 = `${words[6] >>> 8}.${words[6] & 0xff}.${words[7] >>> 8}.${words[7] & 0xff}`;
    return isNonPublicIPv4(ipv4);
  }

  if (words.every((word) => word === 0)) return true; // Unspecified
  if (words.slice(0, 7).every((word) => word === 0) && words[7] === 1) return true; // Loopback
  if ((words[0] & 0xfe00) === 0xfc00) return true; // Unique local (fc00::/7)
  if ((words[0] & 0xffc0) === 0xfe80) return true; // Link-local (fe80::/10)
  if ((words[0] & 0xffc0) === 0xfec0) return true; // Deprecated site-local (fec0::/10)
  if ((words[0] & 0xff00) === 0xff00) return true; // Multicast (ff00::/8)
  if (words[0] === 0x0100 && words.slice(1, 4).every((word) => word === 0)) return true; // Discard-only (100::/64)
  if (words[0] === 0x2001 && words[1] === 0x0db8) return true; // Documentation (2001:db8::/32)
  if (words.slice(0, 6).every((word) => word === 0)) return true; // Deprecated IPv4-compatible (::/96)

  return false;
}

function isNonPublicIpAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return isNonPublicIPv4(ip);
  if (version === 6) return isNonPublicIPv6(ip);
  return false;
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
}

function parseTargetUrl(raw: string): URL | undefined {
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}

export function validateTargetUrl(raw: string): ValidationResult {
  const parsed = parseTargetUrl(raw);
  if (!parsed) {
    return { ok: false, reason: 'Enter a valid URL (e.g. https://example.com/api).' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: 'Only http and https URLs are allowed.' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'URLs containing credentials are not allowed.' };
  }

  const host = normalizeHostname(parsed.hostname);

  if (BLOCKED_HOSTNAMES.has(host)) {
    return { ok: false, reason: 'Requests to localhost are blocked to prevent SSRF.' };
  }

  const ipVersion = isIP(host);
  if (ipVersion !== 0) {
    if (isNonPublicIpAddress(host)) {
      const family = ipVersion === 4 ? 'IP ranges' : 'IPv6 ranges';
      return {
        ok: false,
        reason: `Requests to private, local, or non-public ${family} are blocked to prevent SSRF.`,
      };
    }
    return { ok: true };
  }

  if (host.endsWith('.local') || host.endsWith('.internal')) {
    return { ok: false, reason: 'Requests to internal network hostnames are blocked to prevent SSRF.' };
  }

  return { ok: true };
}

export async function validateTargetUrlDns(raw: string): Promise<ValidationResult> {
  const validation = validateTargetUrl(raw);
  if (!validation.ok) return validation;

  const parsed = parseTargetUrl(raw);
  if (!parsed) return validation;

  const host = normalizeHostname(parsed.hostname);
  if (isIP(host) !== 0) return { ok: true };

  let addresses: string[];
  try {
    const results = await lookup(host, { all: true, verbatim: true });
    addresses = results.map((result) => result.address);
  } catch {
    return { ok: false, reason: 'Unable to safely resolve the target hostname.' };
  }

  if (addresses.length === 0) {
    return { ok: false, reason: 'Unable to resolve the target hostname.' };
  }

  if (addresses.some((address) => isIP(address) === 0 || isNonPublicIpAddress(address))) {
    return {
      ok: false,
      reason: 'The target hostname resolves to a private, local, or non-public IP address.',
    };
  }

  return { ok: true };
}
