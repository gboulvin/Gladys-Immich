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
  assert.match(manifest.gladys_version, /4\.86/);
  assert.match(manifest.docker_image, /^ghcr\.io\/.+:.+$/);
  assert.match(manifest.cover_image, /^https:\/\//);
  assert.ok(manifest.description.en.length >= 10);
  assert.ok(manifest.description.fr.length >= 10);
});

test('declares valid catalog categories for Gladys 4.86', () => {
  const validCategories = new Set([
    'climate',
    'lighting',
    'energy',
    'security',
    'multimedia',
    'appliances',
    'environment',
    'protocols',
    'network',
    'notifications',
    'assistants',
    'services',
  ]);

  assert.ok(manifest.categories.length >= 1 && manifest.categories.length <= 3);
  assert.deepEqual(manifest.categories, ['multimedia']);
  assert.ok(manifest.categories.every((category) => validCategories.has(category)));

  const minimumVersion = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.\d+/);
  assert.ok(minimumVersion, 'gladys_version must declare a minimum version');
  const [, major, minor] = minimumVersion.map(Number);
  assert.ok(
    major > 4 || (major === 4 && minor >= 86),
    `categories requires gladys_version >= 4.86.0, got "${manifest.gladys_version}"`,
  );
});

test('declares the supported local and cloud transports', () => {
  assert.deepEqual(manifest.transports, ['local', 'cloud']);
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

test('protects the Immich API keys and defines actions for both slideshows', () => {
  const apiKey = manifest.config_schema.find((field) => field.key === 'api_key');
  const secondApiKey = manifest.config_schema.find((field) => field.key === 'api_key_2');
  assert.equal(apiKey.type, 'secret');
  assert.equal(apiKey.required, true);
  assert.equal(secondApiKey.type, 'secret');
  assert.equal(secondApiKey.required, false);
  assert.match(manifest.config_schema[0].description.en, /asset\.read/);

  assert.deepEqual(
    manifest.actions.map((action) => action.key),
    [
      'test_connection',
      'list_albums',
      'refresh_now',
      'test_connection_2',
      'list_albums_2',
      'refresh_now_2',
    ],
  );
});

test('uses purely presentational documentation sections', () => {
  const sections = manifest.config_schema.filter((field) => field.type === 'section');
  assert.equal(sections.length, 2);
  for (const section of sections) {
    assert.equal(section.default, undefined);
    assert.equal(section.required, undefined);
  }
  assert.ok(sections[0].links.every((link) => link.url.startsWith('https://')));
  assert.match(sections[1].label.fr, /Diaporama 2/);
});
