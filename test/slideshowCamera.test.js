import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeConfig } from '../src/config.js';
import {
  createSlideshowCamera,
  secondSlideshowCamera,
  slideshowCamera,
} from '../src/devices/slideshowCamera.js';

function createGladysIds() {
  return {
    externalIds(type, platformId) {
      return {
        device: `ext:${type}:${platformId}`,
        feature: (feature) => `ext:${type}:${platformId}:${feature}`,
      };
    },
  };
}

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

  assert.equal(first.external_id, 'ext:camera:immich-slideshow');
  assert.equal(second.external_id, 'ext:camera:immich-slideshow-2');
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
