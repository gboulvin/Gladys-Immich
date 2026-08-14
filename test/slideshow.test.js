import assert from 'node:assert/strict';
import test from 'node:test';
import { SOURCE_MODES } from '../src/config.js';
import { EmptyPhotoSourceError, ImmichSlideshow } from '../src/slideshow.js';

const config = {
  immich_url: 'http://immich.local:2283',
  api_key: 'key',
  source_mode: SOURCE_MODES.ALBUM,
  album_id: 'album-id',
  album_ids: ['album-id'],
  source_refresh_interval: 300,
  max_assets: 20,
  random_order: false,
};

function createClient({ assets = [] } = {}) {
  let albumCalls = 0;
  let previewCalls = 0;
  return {
    get albumCalls() {
      return albumCalls;
    },
    get previewCalls() {
      return previewCalls;
    },
    async getAlbum() {
      albumCalls += 1;
      return { albumName: 'Album', assetCount: assets.length };
    },
    async getAlbumAssets(albumIds, { size }) {
      assert.equal(albumIds, 'album-id');
      assert.equal(size, config.max_assets);
      return assets;
    },
    async getPreview(assetId) {
      previewCalls += 1;
      return { contentType: 'image/jpeg', buffer: Buffer.from(assetId) };
    },
    async testConnection() {
      return { albumCount: 3 };
    },
  };
}

test('fetches only the next preview while caching the resolved album', async () => {
  const client = createClient({
    assets: [
      { id: 'first', type: 'IMAGE', fileCreatedAt: '2024-01-01T00:00:00.000Z' },
      { id: 'second', type: 'IMAGE', fileCreatedAt: '2023-01-01T00:00:00.000Z' },
    ],
  });
  const slideshow = new ImmichSlideshow({
    clientFactory: () => client,
    imageTransformer: async (buffer) => ({ contentType: 'image/jpeg', buffer }),
    now: () => 1_000,
  });

  const first = await slideshow.next(config);
  const second = await slideshow.next(config);

  assert.equal(first.id, 'first');
  assert.equal(second.id, 'second');
  assert.equal(client.albumCalls, 1);
  assert.equal(client.previewCalls, 2);
  assert.equal(first.image, `image/jpeg;base64,${Buffer.from('first').toString('base64')}`);
  assert.equal(slideshow.getStatus().loadedImageCount, 2);
});

test('refreshes the source when requested explicitly', async () => {
  let now = 0;
  const client = createClient({ assets: [{ id: 'image', type: 'IMAGE' }] });
  const slideshow = new ImmichSlideshow({
    clientFactory: () => client,
    imageTransformer: async (buffer) => ({ contentType: 'image/jpeg', buffer }),
    now: () => now,
  });

  await slideshow.refresh(config);
  now = 1_000;
  await slideshow.refresh(config);
  assert.equal(client.albumCalls, 1);

  await slideshow.refresh(config, { force: true });
  assert.equal(client.albumCalls, 2);
});

test('fails clearly when the selected source has no images', async () => {
  const slideshow = new ImmichSlideshow({
    clientFactory: () => createClient(),
    imageTransformer: async (buffer) => ({ contentType: 'image/jpeg', buffer }),
  });

  await assert.rejects(slideshow.next(config), (error) => {
    assert.ok(error instanceof EmptyPhotoSourceError);
    assert.equal(error.code, 'EMPTY_SOURCE');
    return true;
  });
});

test('lists available albums before an album UUID is selected', async () => {
  const client = {
    async listAlbums() {
      return [{ id: 'album-1', albumName: 'Family', assetCount: 42 }];
    },
  };
  const slideshow = new ImmichSlideshow({ clientFactory: () => client });

  const albums = await slideshow.listAlbums({ ...config, album_id: '', album_ids: [] });

  assert.deepEqual(albums, [{ id: 'album-1', name: 'Family', assetCount: 42 }]);
});

test('forwards an Immich caption to the renderer only when enabled', async () => {
  const client = {
    async getAlbum() {
      return { albumName: 'Album' };
    },
    async getAlbumAssets() {
      return [{ id: 'image', type: 'IMAGE', description: 'Sunset at home' }];
    },
    async getPreview() {
      return { contentType: 'image/jpeg', buffer: Buffer.from('image') };
    },
  };
  const captions = [];
  const slideshow = new ImmichSlideshow({
    clientFactory: () => client,
    imageTransformer: async (buffer, options) => {
      captions.push(options.caption);
      return { contentType: 'image/jpeg', buffer };
    },
  });

  await slideshow.next({ ...config, show_caption: false });
  await slideshow.next({ ...config, show_caption: true });

  assert.deepEqual(captions, ['', 'Sunset at home']);
});
