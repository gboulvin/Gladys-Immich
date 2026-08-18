import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CONFIG,
  getSlideshowConfig,
  normalizeConfig,
  SOURCE_MODES,
  validateConfig,
  validateConnectionConfig,
} from '../src/config.js';

test('normalizes Immich URL, booleans and numeric limits', () => {
  const config = normalizeConfig({
    immich_url: ' https://immich.example.test/// ',
    api_key: '  top-secret  ',
    source_mode: SOURCE_MODES.MEMORIES,
    slide_interval: '1',
    source_refresh_interval: '999999',
    max_assets: '999',
    random_order: 'true',
    show_caption: 'true',
  });

  assert.equal(config.immich_url, 'https://immich.example.test');
  assert.equal(config.api_key, 'top-secret');
  assert.equal(config.source_mode, SOURCE_MODES.MEMORIES);
  assert.equal(config.slide_interval, 10);
  assert.equal(config.source_refresh_interval, 86_400);
  assert.equal(config.max_assets, 500);
  assert.equal(config.random_order, true);
  assert.equal(config.show_caption, true);
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

test('keeps the second slideshow profile independent from the first', () => {
  const config = normalizeConfig({
    immich_url: 'https://first-immich.example.test',
    api_key: 'first-key',
    album_id: 'first-album',
    immich_url_2: ' https://second-immich.example.test/// ',
    api_key_2: ' second-key ',
    source_mode_2: SOURCE_MODES.MEMORIES,
    slide_interval_2: '120',
    random_order_2: 'true',
    show_caption_2: true,
  });

  assert.deepEqual(getSlideshowConfig(config, 1), {
    immich_url: 'https://first-immich.example.test',
    api_key: 'first-key',
    source_mode: SOURCE_MODES.ALBUM,
    album_id: 'first-album',
    album_ids: ['first-album'],
    slide_interval: 60,
    source_refresh_interval: 3_600,
    max_assets: 200,
    random_order: false,
    show_caption: false,
  });
  assert.deepEqual(getSlideshowConfig(config, 2), {
    immich_url: 'https://second-immich.example.test',
    api_key: 'second-key',
    source_mode: SOURCE_MODES.MEMORIES,
    album_id: '',
    album_ids: [],
    slide_interval: 120,
    source_refresh_interval: 3_600,
    max_assets: 200,
    random_order: true,
    show_caption: true,
  });
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
  assert.equal(validateConnectionConfig(withoutAlbum), null);

  const memories = normalizeConfig({
    immich_url: 'http://immich.local:2283',
    api_key: 'key',
    source_mode: SOURCE_MODES.MEMORIES,
  });
  assert.equal(validateConfig(memories), null);
});

test('normalizes a comma- or line-separated list of album UUIDs', () => {
  const config = normalizeConfig({
    album_id: 'album-one, album-two\nalbum-one; album-three',
  });

  assert.deepEqual(config.album_ids, ['album-one', 'album-two', 'album-three']);
  assert.equal(config.album_id, 'album-one, album-two, album-three');
});
