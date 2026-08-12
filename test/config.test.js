import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_CONFIG, normalizeConfig, SOURCE_MODES, validateConfig } from '../src/config.js';

test('normalizes Immich URL, booleans and numeric limits', () => {
  const config = normalizeConfig({
    immich_url: ' https://immich.example.test/// ',
    api_key: '  top-secret  ',
    source_mode: SOURCE_MODES.MEMORIES,
    slide_interval: '1',
    source_refresh_interval: '999999',
    max_assets: '999',
    random_order: 'true',
  });

  assert.equal(config.immich_url, 'https://immich.example.test');
  assert.equal(config.api_key, 'top-secret');
  assert.equal(config.source_mode, SOURCE_MODES.MEMORIES);
  assert.equal(config.slide_interval, 10);
  assert.equal(config.source_refresh_interval, 86_400);
  assert.equal(config.max_assets, 500);
  assert.equal(config.random_order, true);
});

test('falls back to safe defaults for malformed settings', () => {
  const config = normalizeConfig({
    immich_url: 'ftp://immich.example.test',
    source_mode: 'unknown',
    slide_interval: 'not-a-number',
  });

  assert.equal(config.immich_url, '');
  assert.equal(config.source_mode, SOURCE_MODES.ALBUM);
  assert.equal(config.slide_interval, DEFAULT_CONFIG.slide_interval);
});

test('explains the first missing required setting', () => {
  assert.match(validateConfig(normalizeConfig()).fr, /URL.*Immich/);

  const withoutKey = normalizeConfig({ immich_url: 'http://immich.local:2283' });
  assert.match(validateConfig(withoutKey).en, /API key/);

  const withoutAlbum = normalizeConfig({
    immich_url: 'http://immich.local:2283',
    api_key: 'key',
    source_mode: SOURCE_MODES.ALBUM,
  });
  assert.match(validateConfig(withoutAlbum).fr, /UUID/);

  const memories = normalizeConfig({
    immich_url: 'http://immich.local:2283',
    api_key: 'key',
    source_mode: SOURCE_MODES.MEMORIES,
  });
  assert.equal(validateConfig(memories), null);
});
