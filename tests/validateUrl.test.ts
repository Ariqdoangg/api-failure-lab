import { describe, expect, it } from 'vitest';
import { validateTargetUrl } from '../server/validateUrl.js';

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

  it.each(['[::]', '[::1]', '[fc00::1]', '[fd00::1]', '[fe80::1]'])(
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

  it.each(['https://example.com/api', 'http://8.8.8.8/', 'https://public.example.test:8443/path'])(
    'allows public HTTP(S) URL %s',
    (url) => {
      expect(validateTargetUrl(url)).toEqual({ ok: true });
    },
  );

  describe('known SSRF gaps deferred to the security refactor', () => {
    it.todo('resolves hostnames and rejects those resolving to private or loopback addresses');
    it.todo('pins validated DNS results to prevent DNS rebinding between validation and connection');
    it.todo('revalidates every redirect target before following it');

    it.skip('rejects IPv4-mapped IPv6 loopback addresses after URL canonicalization', () => {
      expect(validateTargetUrl('http://[::ffff:127.0.0.1]/api')).toMatchObject({ ok: false });
      expect(validateTargetUrl('http://[::ffff:7f00:1]/api')).toMatchObject({ ok: false });
    });

    it.skip('rejects the full multicast and reserved IPv4 ranges', () => {
      for (const address of [
        '224.0.0.0',
        '239.255.255.255',
        '240.0.0.0',
        '254.0.0.1',
        '255.255.255.255',
      ]) {
        expect(validateTargetUrl(`http://${address}/api`)).toMatchObject({ ok: false });
      }
    });
  });
});
