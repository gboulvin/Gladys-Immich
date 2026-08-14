import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEFAULT_CONFIG } from '../src/config.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);

test('declares an installable Gladys device integration', () => {
  assert.equal(manifest.manifest_version, 1);
  assert.equal(manifest.type, 'device');
  assert.match(manifest.name, /^Immich Slideshow$/);
  assert.match(manifest.gladys_version, /4\.85/);
  assert.match(manifest.docker_image, /^ghcr\.io\/.+:.+$/);
  assert.match(manifest.cover_image, /^https:\/\//);
  assert.ok(manifest.description.en.length >= 10);
  assert.ok(manifest.description.fr.length >= 10);
});

test('keeps manifest defaults aligned with runtime defaults', () => {
  for (const field of manifest.config_schema) {
    if (field.default !== undefined) {
      assert.equal(
        DEFAULT_CONFIG[field.key],
        field.default,
        `DEFAULT_CONFIG.${field.key} must match the manifest default`,
      );
    }
  }
});

test('protects the Immich API key and defines the runtime actions', () => {
  const apiKey = manifest.config_schema.find((field) => field.key === 'api_key');
  assert.equal(apiKey.type, 'secret');
  assert.equal(apiKey.required, true);
  assert.match(manifest.config_schema[0].description.en, /asset\.read/);

  assert.deepEqual(
    manifest.actions.map((action) => action.key),
    ['test_connection', 'list_albums', 'refresh_now'],
  );
});

test('uses purely presentational documentation sections', () => {
  const section = manifest.config_schema.find((field) => field.type === 'section');
  assert.ok(section);
  assert.equal(section.default, undefined);
  assert.equal(section.required, undefined);
  assert.ok(section.links.every((link) => link.url.startsWith('https://')));
});
