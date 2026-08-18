import { beforeEach, describe, expect, it, vi } from 'vitest';
import { validateTargetUrl, validateTargetUrlDns } from '../server/validateUrl.js';

const dnsMocks = vi.hoisted(() => ({
  lookup: vi.fn(),
}));

vi.mock('node:dns/promises', () => dnsMocks);

beforeEach(() => {
  dnsMocks.lookup.mockReset();
  dnsMocks.lookup.mockRejectedValue(new Error('No DNS test response configured.'));
});

describe('validateTargetUrl', () => {
  it.each(['', 'not a url', 'https://'])('rejects malformed URL %j', (url) => {
    expect(validateTargetUrl(url)).toMatchObject({ ok: false });
  });

  it.each(['ftp://example.com/file', 'file:///etc/passwd', 'javascript:alert(1)'])(
    'rejects non-HTTP protocol %s',
    (url) => {
      expect(validateTargetUrl(url)).toEqual({
        ok: false,
        reason: 'Only http and https URLs are allowed.',
      });
    },
  );

  it.each(['http://user@example.com/api', 'https://user:password@example.com/api'])(
    'rejects URL credentials in %s',
    (url) => {
      expect(validateTargetUrl(url)).toEqual({
        ok: false,
        reason: 'URLs containing credentials are not allowed.',
      });
    },
  );

  it.each(['localhost', 'ip6-localhost', 'ip6-loopback', 'broadcasthost'])(
    'rejects blocked hostname %s',
    (hostname) => {
      expect(validateTargetUrl(`http://${hostname}/api`)).toMatchObject({ ok: false });
    },
  );

  it.each([
    '0.0.0.0',
    '10.1.2.3',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '100.64.0.1',
    '100.127.255.255',
    '224.0.0.1',
    '240.0.0.1',
    '255.255.255.255',
  ])('rejects protected IPv4 address %s', (hostname) => {
    expect(validateTargetUrl(`http://${hostname}/api`)).toMatchObject({ ok: false });
  });

  it.each([
    '[::]',
    '[::1]',
    '[fc00::1]',
    '[fd00::1]',
    '[fe80::1]',
    '[fec0::1]',
    '[ff02::1]',
    '[100::1]',
    '[2001:db8::1]',
  ])(
    'rejects protected IPv6 address %s',
    (hostname) => {
      expect(validateTargetUrl(`http://${hostname}/api`)).toMatchObject({ ok: false });
    },
  );

  it.each(['service.local', 'metadata.internal'])(
    'rejects internal hostname suffix %s',
    (hostname) => {
      expect(validateTargetUrl(`https://${hostname}/api`)).toMatchObject({ ok: false });
    },
  );

  it.each(['localhost.', 'LOCALHOST...', 'service.local.', 'metadata.internal.'])(
    'rejects trailing-dot local hostname %s',
    (hostname) => {
      expect(validateTargetUrl(`https://${hostname}/api`)).toMatchObject({ ok: false });
    },
  );

  it.each(['https://example.com/api', 'http://8.8.8.8/', 'https://public.example.test:8443/path'])(
    'allows public HTTP(S) URL %s',
    (url) => {
      expect(validateTargetUrl(url)).toEqual({ ok: true });
    },
  );

  describe('address range hardening', () => {
    it.todo('pins validated DNS results to prevent DNS rebinding between validation and connection');
    it.todo('revalidates every redirect target before following it');

    it('rejects IPv4-mapped IPv6 addresses when the embedded IPv4 address is blocked', () => {
      expect(validateTargetUrl('http://[::ffff:127.0.0.1]/api')).toMatchObject({ ok: false });
      expect(validateTargetUrl('http://[::ffff:7f00:1]/api')).toMatchObject({ ok: false });
      expect(validateTargetUrl('http://[::ffff:10.1.2.3]/api')).toMatchObject({ ok: false });
      expect(validateTargetUrl('http://[::ffff:8.8.8.8]/api')).toEqual({ ok: true });
    });

    it('rejects the full multicast and reserved IPv4 ranges', () => {
      for (const address of [
        '192.0.0.0',
        '192.0.0.8',
        '192.0.0.11',
        '192.0.0.255',
        '192.0.2.0',
        '192.0.2.255',
        '192.88.99.0',
        '192.88.99.255',
        '198.18.0.0',
        '198.19.255.255',
        '198.51.100.0',
        '198.51.100.255',
        '203.0.113.0',
        '203.0.113.255',
        '224.0.0.0',
        '239.255.255.255',
        '240.0.0.0',
        '254.0.0.1',
        '255.255.255.255',
      ]) {
        expect(validateTargetUrl(`http://${address}/api`)).toMatchObject({ ok: false });
      }

      expect(validateTargetUrl('http://223.255.255.255/api')).toEqual({ ok: true });
      expect(validateTargetUrl('http://192.0.0.9/api')).toEqual({ ok: true });
      expect(validateTargetUrl('http://192.0.0.10/api')).toEqual({ ok: true });
    });

    it.each(['[fe80::1]', '[fe9f::1234]', '[febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff]'])(
      'rejects representative address in fe80::/10: %s',
      (hostname) => {
        expect(validateTargetUrl(`http://${hostname}/api`)).toMatchObject({ ok: false });
      },
    );
  });

  describe('DNS address validation', () => {
    it('rejects a public hostname resolving to private IPv4', async () => {
      dnsMocks.lookup.mockResolvedValue([{ address: '10.20.30.40', family: 4 }]);

      await expect(validateTargetUrlDns('https://api.example.com/data')).resolves.toMatchObject({
        ok: false,
      });
      expect(dnsMocks.lookup).toHaveBeenCalledWith('api.example.com', {
        all: true,
        verbatim: true,
      });
    });

    it('rejects a public hostname resolving to private IPv6', async () => {
      dnsMocks.lookup.mockResolvedValue([
        { address: '93.184.216.34', family: 4 },
        { address: 'fd12:3456:789a::1', family: 6 },
      ]);

      await expect(validateTargetUrlDns('https://api.example.com/data')).resolves.toMatchObject({
        ok: false,
      });
    });

    it('accepts a normal public DNS target', async () => {
      dnsMocks.lookup.mockResolvedValue([
        { address: '93.184.216.34', family: 4 },
        { address: '2606:4700:4700::1111', family: 6 },
      ]);

      await expect(validateTargetUrlDns('https://PUBLIC.example.com./data')).resolves.toEqual({
        ok: true,
      });
      expect(dnsMocks.lookup).toHaveBeenCalledWith('public.example.com', {
        all: true,
        verbatim: true,
      });
    });
  });
});
