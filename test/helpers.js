// -----------------------------------------------------------------------------
// Shared test setup: the SDK wiring (src/app.js) on the fake Gladys of the SDK,
// with cameras backed by a fake slideshow, so no test touches the network.
// -----------------------------------------------------------------------------

import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import { createSlideshowCamera } from '../src/devices/slideshowCamera.js';

// A valid 1×1 JPEG: the widget image checks read the real magic numbers.
export const TINY_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRof' +
  'Hh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwh' +
  'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAAR' +
  'CAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAA' +
  'AgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkK' +
  'FhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWG' +
  'h4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl' +
  '5ufo6erx8vP09fb3+Pn6/9oADAMBAAIRAxEAPwCwooor8/P3E//Z';

export const FIRST_PROFILE = {
  immich_url: 'http://192.168.1.20:2283',
  api_key: 'first-key',
  album_id: 'album-1',
};

export function createFakeSlideshow({ failNext = null } = {}) {
  const slideshow = {
    failNext,
    nextCalls: 0,
    async next() {
      slideshow.nextCalls += 1;
      if (slideshow.failNext) {
        throw slideshow.failNext;
      }
      return {
        id: `0a1b2c3d-0000-4000-8000-00000000000${slideshow.nextCalls % 10}`,
        originalFileName: `IMG_${slideshow.nextCalls}.jpg`,
        caption: 'Biarritz · 14 juillet 2024',
        image: `image/jpeg;base64,${TINY_JPEG_BASE64}`,
        sourceName: 'Holidays',
      };
    },
    async testConnection() {
      return { albumCount: 3 };
    },
    async listAlbums() {
      return [{ id: 'album-1', name: 'Holidays', assetCount: 12 }];
    },
    async refresh() {},
    reset() {},
    getStatus() {
      return { sourceName: 'Holidays', loadedImageCount: 12, totalImageCount: 40 };
    },
  };
  return slideshow;
}

export function setup({ config = FIRST_PROFILE, failNext = null } = {}) {
  const slideshows = [createFakeSlideshow({ failNext }), createFakeSlideshow()];
  const blueprints = [
    createSlideshowCamera({
      key: 'camera-1',
      platformDeviceId: 'immich-slideshow',
      profileNumber: 1,
      name: 'Immich slideshow',
      slideshow: slideshows[0],
    }),
    createSlideshowCamera({
      key: 'camera-2',
      platformDeviceId: 'immich-slideshow-2',
      profileNumber: 2,
      name: 'Immich slideshow 2',
      slideshow: slideshows[1],
    }),
  ];
  const gladys = createFakeGladys({ config });
  const app = registerHandlers(gladys, { blueprints });
  return { gladys, app, blueprints, slideshows };
}

// The slideshow loop publishes its first slide in the background.
export async function settle() {
  for (let i = 0; i < 20; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}
