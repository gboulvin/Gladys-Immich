import assert from 'node:assert/strict';
import test from 'node:test';
import { slideshowCamera } from '../src/devices/slideshowCamera.js';

test('declares required numeric bounds for the camera image feature', () => {
  const gladys = {
    externalIds(type, platformId) {
      return {
        device: `ext:${type}:${platformId}`,
        feature: (feature) => `ext:${type}:${platformId}:${feature}`,
      };
    },
  };

  const device = slideshowCamera.buildDevice(gladys);
  const [imageFeature] = device.features;

  assert.equal(imageFeature.name, 'Image');
  assert.equal(imageFeature.min, 0);
  assert.equal(imageFeature.max, 1);
  assert.equal(Number.isFinite(imageFeature.min), true);
  assert.equal(Number.isFinite(imageFeature.max), true);
});
