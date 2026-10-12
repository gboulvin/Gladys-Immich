// -----------------------------------------------------------------------------
// The `show_next_photo` scene action, through the fake Gladys of the SDK.
// -----------------------------------------------------------------------------

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { ImmichApiError } from '../src/immichClient.js';
import { settle, setup } from './helpers.js';

const manifest = JSON.parse(
  await readFile(new URL('../gladys-assistant-integration.json', import.meta.url), 'utf8'),
);
const declaredOutputs = manifest.scene_actions
  .find((action) => action.key === 'show_next_photo')
  .outputs.map((output) => output.key)
  .sort();

async function connected(t, options) {
  const context = setup(options);
  t.after(() => context.app.stop());
  await context.gladys.connect();
  await settle();
  return context;
}

test('shows the next photo on the chosen camera and returns the declared outputs', async (t) => {
  const { gladys, blueprints } = await connected(t);
  const camera = blueprints[0].deviceExternalId(gladys);
  const images = gladys.fake.cameraImages.length;

  const ack = await gladys.fake.sceneAction('show_next_photo', { camera, refresh: false });
  assert.equal(ack.success, true);
  const outputs = ack.data.outputs;
  assert.deepEqual(Object.keys(outputs).sort(), declaredOutputs);
  assert.deepEqual(outputs, { displayed: true, file_name: 'IMG_2.jpg', source_name: 'Holidays' });
  assert.equal(gladys.fake.cameraImages.length, images + 1);
  assert.equal(gladys.fake.cameraImages.at(-1).device_external_id, camera);
});

test('re-reads the source first when asked', async (t) => {
  const { gladys, blueprints, slideshows } = await connected(t);
  let refreshed = false;
  slideshows[0].refresh = async () => {
    refreshed = true;
  };
  const ack = await gladys.fake.sceneAction('show_next_photo', {
    camera: blueprints[0].deviceExternalId(gladys),
    refresh: true,
  });
  assert.equal(refreshed, true);
  assert.equal(ack.data.outputs.displayed, true);
});

test('an unusable slideshow is an output, never a failed scene action', async (t) => {
  const { gladys, blueprints, slideshows } = await connected(t);
  const notDisplayed = { displayed: false, file_name: '', source_name: '' };

  // Slideshow 2 is not configured.
  const idle = await gladys.fake.sceneAction('show_next_photo', {
    camera: blueprints[1].deviceExternalId(gladys),
  });
  assert.equal(idle.success, true);
  assert.deepEqual(idle.data.outputs, notDisplayed);

  // Immich fails: the scene goes on, and the status shows the error.
  slideshows[0].failNext = new ImmichApiError('denied', { status: 401 });
  const failed = await gladys.fake.sceneAction('show_next_photo', {
    camera: blueprints[0].deviceExternalId(gladys),
  });
  assert.equal(failed.success, true);
  assert.deepEqual(failed.data.outputs, notDisplayed);
  assert.equal(gladys.fake.connectionStatus.connected, false);
});
