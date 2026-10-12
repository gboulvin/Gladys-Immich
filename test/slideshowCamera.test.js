import assert from 'node:assert/strict';
import test from 'node:test';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { normalizeConfig } from '../src/config.js';
import { ImmichApiError } from '../src/immichClient.js';
import {
  createSlideshowCamera,
  secondSlideshowCamera,
  slideshowCamera,
} from '../src/devices/slideshowCamera.js';
import { EmptyPhotoSourceError } from '../src/slideshow.js';

// The fake Gladys of the SDK builds the external ids exactly like production,
// with the `test-integration` selector.
const createGladysIds = () => createFakeGladys();

test('declares required numeric bounds for each camera image feature', () => {
  const gladys = createGladysIds();

  for (const camera of [slideshowCamera, secondSlideshowCamera]) {
    const device = camera.buildDevice(gladys);
    const [imageFeature] = device.features;

    assert.equal(imageFeature.name, 'Image');
    assert.equal(imageFeature.min, 0);
    assert.equal(imageFeature.max, 1);
    assert.equal(Number.isFinite(imageFeature.min), true);
    assert.equal(Number.isFinite(imageFeature.max), true);
  }
});

test('declares two independently creatable virtual camera devices', () => {
  const gladys = createGladysIds();
  const first = slideshowCamera.buildDevice(gladys);
  const second = secondSlideshowCamera.buildDevice(gladys);

  assert.equal(first.external_id, 'ext:test-integration:camera:immich-slideshow');
  assert.equal(second.external_id, 'ext:test-integration:camera:immich-slideshow-2');
  assert.notEqual(first.external_id, second.external_id);
  assert.equal(first.name, 'Immich slideshow');
  assert.equal(second.name, 'Immich slideshow 2');
});

test('routes each camera to its own normalized slideshow profile and runtime', async () => {
  const observedProfiles = [];
  const createFakeSlideshow = (runtime) => ({
    async next(config) {
      observedProfiles.push({ runtime, config });
      return {
        id: runtime,
        image: `image/jpg;base64,${runtime}`,
        sourceName: runtime,
      };
    },
    reset() {},
  });
  const first = createSlideshowCamera({
    key: 'test-first',
    platformDeviceId: 'test-first',
    profileNumber: 1,
    name: 'Test first slideshow',
    slideshow: createFakeSlideshow('first'),
  });
  const second = createSlideshowCamera({
    key: 'test-second',
    platformDeviceId: 'test-second',
    profileNumber: 2,
    name: 'Test second slideshow',
    slideshow: createFakeSlideshow('second'),
  });
  const config = normalizeConfig({
    immich_url: 'https://first.example.test',
    api_key: 'first-key',
    album_id: 'first-album',
    immich_url_2: 'https://second.example.test',
    api_key_2: 'second-key',
    album_id_2: 'second-album',
    slide_interval_2: 120,
  });

  assert.equal(await first.onGetImage({}, { config }), 'image/jpg;base64,first');
  assert.equal(await second.onGetImage({}, { config }), 'image/jpg;base64,second');
  assert.deepEqual(
    observedProfiles.map(({ runtime, config: profile }) => ({
      runtime,
      url: profile.immich_url,
      key: profile.api_key,
      albumIds: profile.album_ids,
      slideInterval: profile.slide_interval,
    })),
    [
      {
        runtime: 'first',
        url: 'https://first.example.test',
        key: 'first-key',
        albumIds: ['first-album'],
        slideInterval: 60,
      },
      {
        runtime: 'second',
        url: 'https://second.example.test',
        key: 'second-key',
        albumIds: ['second-album'],
        slideInterval: 120,
      },
    ],
  );
});

test('Gladys accepts the discovered cameras', async () => {
  const gladys = createFakeGladys();
  await gladys.publishDiscoveredDevices([
    slideshowCamera.buildDevice(gladys),
    secondSlideshowCamera.buildDevice(gladys),
  ]);
  assert.equal(gladys.fake.discoveredDevices.length, 2);
});

test('reports the transport from the Immich URL and the last outcome', () => {
  const local = normalizeConfig({
    immich_url: 'http://192.168.1.20:2283',
    api_key: 'key',
    album_id: 'album',
  });
  const remote = normalizeConfig({
    immich_url: 'https://photos.example.net',
    api_key: 'key',
    album_id: 'album',
  });

  assert.equal(slideshowCamera.transport(normalizeConfig({}), undefined), null);
  assert.deepEqual(slideshowCamera.transport(local, null), { transport: 'local' });
  assert.deepEqual(slideshowCamera.transport(remote, undefined), { transport: 'cloud' });
  assert.deepEqual(
    slideshowCamera.transport(local, new ImmichApiError('down', { code: 'UNREACHABLE' })),
    { transport: 'unreachable' },
  );

  const denied = slideshowCamera.transport(remote, new ImmichApiError('no', { status: 401 }));
  assert.equal(denied.transport, 'cloud');
  assert.equal(denied.degraded, true);
  assert.match(denied.message.fr, /clé API/);

  const empty = slideshowCamera.transport(local, new EmptyPhotoSourceError('Album'));
  assert.equal(empty.degraded, true);
  assert.match(empty.message.en, /no images/);

  // The second camera reads its own profile only.
  assert.equal(secondSlideshowCamera.transport(local, null), null);
});

test('an incomplete profile is degraded when its URL is usable, unreachable otherwise', () => {
  const noAlbum = normalizeConfig({ immich_url: 'http://nas.local:2283', api_key: 'key' });
  const noUrl = normalizeConfig({ api_key: 'key', album_id: 'album' });

  const degraded = slideshowCamera.transport(noAlbum, undefined);
  assert.equal(degraded.transport, 'local');
  assert.equal(degraded.degraded, true);
  assert.match(degraded.message.en, /album UUID/);
  assert.deepEqual(slideshowCamera.transport(noUrl, undefined), { transport: 'unreachable' });
});

test('every transport entry is accepted by the SDK', async () => {
  const gladys = createFakeGladys();
  const config = normalizeConfig({ immich_url: 'https://photos.example.net', api_key: 'key' });
  const entry = slideshowCamera.transport(config, undefined);
  await gladys.publishTransports([
    { external_id: slideshowCamera.deviceExternalId(gladys), ...entry },
  ]);
  assert.equal(gladys.fake.transports.length, 1);
});
