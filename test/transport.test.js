import assert from 'node:assert/strict';
import test from 'node:test';
import { isLocalUrl, transportForUrl } from '../src/transport.js';

test('private addresses and LAN names are local', () => {
  for (const url of [
    'http://192.168.1.20:2283',
    'http://10.0.0.5',
    'http://172.20.1.1:2283',
    'http://127.0.0.1:2283',
    'http://169.254.10.2',
    'http://100.101.102.103', // Tailscale
    'http://[fd12:3456::1]:2283',
    'http://[fe80::1]',
    'http://[::1]',
    'http://[::ffff:192.168.1.2]',
    'http://immich:2283',
    'http://nas.local:2283',
    'https://photos.home.arpa',
    'http://immich.lan',
    'http://localhost:2283',
  ]) {
    assert.equal(isLocalUrl(url), true, url);
    assert.equal(transportForUrl(url), 'local', url);
  }
});

test('public addresses and Internet names are cloud', () => {
  for (const url of [
    'https://immich.example.net',
    'https://photos.my-domain.fr/immich',
    'http://8.8.8.8',
    'http://172.32.0.1',
    'http://[2001:db8::1]',
  ]) {
    assert.equal(isLocalUrl(url), false, url);
    assert.equal(transportForUrl(url), 'cloud', url);
  }
});

test('an invalid URL is never local', () => {
  assert.equal(isLocalUrl(''), false);
  assert.equal(isLocalUrl('not a url'), false);
});
