import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DEFAULT_CONFIG } from '../src/config.js';
import { DEVICE_BLUEPRINTS } from '../src/devices/index.js';
import { LANGUAGES } from '../src/i18n.js';
import { SCENE_ACTIONS } from '../src/scenes.js';
import { WIDGETS } from '../src/widgets.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const allFields = [
  ...manifest.config_schema,
  ...[...(manifest.actions ?? []), ...(manifest.scene_actions ?? [])].flatMap(
    (action) => action.fields ?? [],
  ),
  ...(manifest.widgets ?? []).flatMap((widget) => widget.settings ?? []),
];
const keysOf = (list) => (list ?? []).map((entry) => entry.key);

test('declares an installable Gladys device integration', () => {
  assert.equal(manifest.manifest_version, 1);
  assert.equal(manifest.type, 'device');
  assert.match(manifest.name, /^Immich Slideshow$/);
  assert.match(manifest.gladys_version, /^>=5\.3\.0$/);
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

test('every manifest action has a handler, and every handler is declared', () => {
  const declared = manifest.actions.map((action) => action.key);
  const handled = DEVICE_BLUEPRINTS.flatMap((blueprint) => Object.keys(blueprint.actions ?? {}));
  for (const key of declared) {
    assert.ok(handled.includes(key), `manifest action "${key}" has no handler`);
  }
  for (const key of handled) {
    assert.ok(declared.includes(key), `handler "${key}" is not declared in the manifest actions`);
  }
});

test('the manifest version is the package version, and the image is tagged with it', () => {
  // The Release workflow writes all three: a mismatch means one was edited by
  // hand, and Gladys would offer a version whose image is another one.
  assert.equal(manifest.version, pkg.version, 'manifest version must match package.json');
  assert.ok(
    manifest.docker_image.endsWith(`:${manifest.version}`),
    `docker_image must be tagged :${manifest.version}, got "${manifest.docker_image}"`,
  );
});

test('the catalog description holds 10 to 100 characters per language', () => {
  for (const [lang, text] of Object.entries(manifest.description)) {
    assert.ok(
      text.length >= 10 && text.length <= 100,
      `description.${lang} has ${text.length} characters (10 to 100 allowed)`,
    );
  }
});

test('every text is a multi-language object in English, French, German and Spanish', () => {
  const texts = [
    ...allFields.flatMap((field) => [
      ['label', field.key, field.label],
      ['description', field.key, field.description],
      ['placeholder', field.key, field.placeholder],
      ...(field.options ?? []).map((option) => ['option', field.key, option.label]),
      ...(field.links ?? []).map((link) => ['link', field.key, link.label]),
    ]),
    ...manifest.actions.map((action) => ['action', action.key, action.label]),
    ...[...manifest.scene_actions, ...manifest.widgets].flatMap((item) => [
      ['label', item.key, item.label],
      ['description', item.key, item.description],
    ]),
    ...manifest.scene_actions.flatMap((action) =>
      action.outputs.map((output) => ['output', output.key, output.label]),
    ),
  ].filter(([, , text]) => text !== undefined);

  for (const [kind, key, text] of texts) {
    assert.equal(typeof text, 'object', `${kind} of "${key}" must be a multi-language object`);
    for (const language of LANGUAGES) {
      assert.ok(text[language], `${kind} of "${key}" needs a "${language}" text`);
    }
  }
});

test('section fields store no value', () => {
  for (const section of manifest.config_schema.filter((field) => field.type === 'section')) {
    assert.equal(section.placeholder, undefined, `section "${section.key}" has a placeholder`);
    assert.ok(!(section.key in DEFAULT_CONFIG), `section "${section.key}" leaks into the config`);
  }
});

test('scene actions and widgets require Gladys >= 5.1.0', () => {
  // Older cores reject unknown manifest fields, and the store validator
  // refuses a lower minimum.
  const [, major, minor] = manifest.gladys_version.match(/>=\s*(\d+)\.(\d+)\.\d+/).map(Number);
  assert.ok(major > 5 || (major === 5 && minor >= 1), manifest.gladys_version);
  assert.equal(manifest.scene_triggers, undefined, 'no trigger is fired by the code');
});

test('every scene_actions key has a handler, and vice versa', () => {
  const declared = keysOf(manifest.scene_actions);
  assert.deepEqual(declared.sort(), Object.keys(SCENE_ACTIONS).sort());
  for (const action of manifest.scene_actions) {
    assert.ok(action.outputs.length > 0, `scene action "${action.key}" declares its outputs`);
    assert.ok(action.timeout_seconds >= 5 && action.timeout_seconds <= 120);
  }
});

test('every widgets key has a content handler, and vice versa', () => {
  const declared = keysOf(manifest.widgets);
  assert.deepEqual(declared.sort(), Object.keys(WIDGETS).sort());
  for (const key of declared) {
    assert.equal(typeof WIDGETS[key].get, 'function', `widget "${key}" has no content handler`);
    assert.match(key, /^[a-z0-9_]{2,32}$/);
  }
  // A store rule, like the catalog description.
  for (const widget of manifest.widgets) {
    for (const [lang, text] of Object.entries(widget.description ?? {})) {
      assert.ok(
        text.length <= 100,
        `widget ${widget.key} description.${lang}: ${text.length} > 100`,
      );
    }
  }
});

test('dynamic selects declare a source and no static options', () => {
  const dynamicSelects = allFields.filter((field) => field.source !== undefined);
  assert.ok(dynamicSelects.length >= 2, 'the scene action and the widget pick a camera');
  for (const field of dynamicSelects) {
    assert.equal(field.source, 'devices');
    assert.equal(field.options, undefined, `field "${field.key}": source and options together`);
  }
});
