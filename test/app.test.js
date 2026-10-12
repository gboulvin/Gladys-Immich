// -----------------------------------------------------------------------------
// End-to-end tests of the SDK wiring (src/app.js), driven by the fake Gladys of
// the SDK: it records what Gladys receives and refuses what Gladys refuses.
// The cameras run on a fake slideshow, so no test touches the network.
// -----------------------------------------------------------------------------

import assert from 'node:assert/strict';
import test from 'node:test';
import { ImmichApiError } from '../src/immichClient.js';
import { FIRST_PROFILE, settle, setup, TINY_JPEG_BASE64 } from './helpers.js';

test('publishes both cameras, the first slide, the status and the transport', async (t) => {
  const { gladys, app, blueprints } = setup();
  t.after(() => app.stop());

  await gladys.connect();
  await settle();

  assert.deepEqual(
    gladys.fake.discoveredDevices.map((device) => device.name),
    ['Immich slideshow', 'Immich slideshow 2'],
  );
  assert.equal(gladys.fake.cameraImages.length, 1);
  assert.equal(
    gladys.fake.cameraImages[0].device_external_id,
    blueprints[0].deviceExternalId(gladys),
  );
  assert.equal(gladys.fake.connectionStatus.connected, true);

  // Only the configured camera gets a badge.
  const transports = gladys.fake.transports;
  assert.ok(transports.length >= 1);
  assert.ok(
    transports.every(
      (entry) => entry.device_external_id === blueprints[0].deviceExternalId(gladys),
    ),
  );
  assert.equal(transports.at(-1).transport, 'local');
});

test('asks to configure a slideshow when none is configured', async (t) => {
  const { gladys, app } = setup({ config: {} });
  t.after(() => app.stop());

  await gladys.connect();
  await settle();

  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.equal(gladys.fake.cameraImages.length, 0);
  assert.equal(gladys.fake.transports.length, 0);
});

test('a failing slideshow turns the status red and the badge unreachable, then recovers', async (t) => {
  const { gladys, app, slideshows } = setup({
    failNext: new ImmichApiError('down', { code: 'UNREACHABLE' }),
  });
  t.after(() => app.stop());

  await gladys.connect();
  await settle();

  assert.equal(gladys.fake.connectionStatus.connected, false);
  assert.match(gladys.fake.connectionStatus.message.fr, /inaccessible/);
  assert.equal(gladys.fake.transports.at(-1).transport, 'unreachable');

  // Immich is back: the next successful action clears the error.
  slideshows[0].failNext = null;
  const ack = await gladys.fake.action('refresh_now');
  assert.equal(ack.success, true);
  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.deepEqual(gladys.fake.transports.at(-1), {
    device_external_id: gladys.externalIds('camera', 'immich-slideshow').device,
    transport: 'local',
  });
});

test('the same failure is reported once, not at every slide', async (t) => {
  const { gladys, app } = setup({
    failNext: new ImmichApiError('denied', { status: 401 }),
  });
  t.after(() => app.stop());

  await gladys.connect();
  await settle();
  const statuses = gladys.fake.connectionStatuses.length;
  const transports = gladys.fake.transports.length;

  // The same 401 again, twice: nothing new to tell the user.
  for (let i = 0; i < 2; i += 1) {
    const ack = await gladys.fake.action('refresh_now');
    assert.equal(ack.success, false);
  }
  assert.equal(gladys.fake.connectionStatuses.length, statuses);
  assert.equal(gladys.fake.transports.length, transports);
  assert.equal(gladys.fake.transports.at(-1).degraded, true);
  assert.match(gladys.fake.connectionStatus.message.en, /API key/);
});

test('serves a fresh slide on demand and answers the actions of each camera', async (t) => {
  const { gladys, app } = setup({
    config: {
      ...FIRST_PROFILE,
      immich_url_2: 'https://photos.example.net',
      api_key_2: 'second-key',
      source_mode_2: 'memories',
    },
  });
  t.after(() => app.stop());

  await gladys.connect();
  await settle();

  const [first, second] = gladys.fake.discoveredDevices;
  assert.deepEqual(await gladys.fake.getImage(first), {
    success: true,
    data: { image: `image/jpeg;base64,${TINY_JPEG_BASE64}` },
  });
  assert.equal((await gladys.fake.getImage(second)).success, true);

  const test1 = await gladys.fake.action('test_connection');
  assert.match(test1.data.message.en, /3 albums found/);
  const albums2 = await gladys.fake.action('list_albums_2');
  assert.match(albums2.data.message.fr, /Holidays — album-1/);

  // The second camera is reached over the Internet.
  const secondBadges = gladys.fake.transports.filter(
    (entry) => entry.device_external_id === second.external_id,
  );
  assert.equal(secondBadges.at(-1).transport, 'cloud');
});

test('a configuration update restarts the slideshows with the new settings', async (t) => {
  const { gladys, app } = setup({ config: {} });
  t.after(() => app.stop());

  await gladys.connect();
  await settle();
  assert.equal(gladys.fake.connectionStatus.connected, false);

  await gladys.fake.configUpdated(FIRST_PROFILE);
  await settle();

  assert.equal(gladys.fake.connectionStatus.connected, true);
  assert.equal(gladys.fake.cameraImages.length, 1);
});
