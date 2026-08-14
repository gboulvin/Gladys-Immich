import assert from 'node:assert/strict';
import test from 'node:test';
import { SOURCE_MODES } from '../src/config.js';
import { assetsFromMemories, buildCaption, ImmichPhotoProvider } from '../src/photoProvider.js';

const recentImage = {
  id: 'image-recent',
  type: 'IMAGE',
  originalFileName: 'recent.jpg',
  fileCreatedAt: '2024-08-12T10:00:00.000Z',
  exifInfo: { description: 'Holiday', city: 'Rome', dateTimeOriginal: '2024-08-12T10:00:00.000Z' },
};
const olderImage = {
  id: 'image-old',
  type: 'IMAGE',
  originalFileName: 'old.jpg',
  fileCreatedAt: '2019-08-12T10:00:00.000Z',
};
const video = { id: 'video-1', type: 'VIDEO', originalFileName: 'movie.mp4' };

test('builds captions only from available Immich metadata', () => {
  assert.match(buildCaption(recentImage, 'en-GB'), /Holiday — Rome — 12 August 2024/);
  assert.equal(buildCaption({ id: 'plain', type: 'IMAGE' }), '');
});

test('resolves album images most-recent first, filters videos and enforces the cap', async () => {
  const client = {
    async getAlbum() {
      return { albumName: 'Summer', assetCount: 3 };
    },
    async getAlbumAssets(albumIds, { size }) {
      assert.deepEqual(albumIds, ['album-id']);
      assert.equal(size, 1);
      return [olderImage, video, recentImage];
    },
  };
  const provider = new ImmichPhotoProvider({ client, locale: 'en-GB' });
  const result = await provider.resolve({
    source_mode: SOURCE_MODES.ALBUM,
    album_id: 'album-id',
    album_ids: ['album-id'],
    random_order: false,
    max_assets: 1,
  });

  assert.equal(result.sourceName, 'Summer');
  assert.equal(result.totalImageCount, 2);
  assert.deepEqual(
    result.photos.map((photo) => photo.id),
    ['image-recent'],
  );
  assert.match(result.photos[0].caption, /Rome/);
});

test('flattens and deduplicates on-this-day memory assets', async () => {
  const client = {
    async getOnThisDayMemories() {
      return [{ assets: [olderImage, recentImage] }, { data: { assets: [recentImage, video] } }];
    },
  };
  const provider = new ImmichPhotoProvider({ client, random: () => 0 });
  const result = await provider.resolve({
    source_mode: SOURCE_MODES.MEMORIES,
    random_order: true,
    max_assets: 10,
  });

  assert.equal(result.totalImageCount, 2);
  assert.deepEqual(
    new Set(result.photos.map((photo) => photo.id)),
    new Set(['image-old', 'image-recent']),
  );
  assert.equal(assetsFromMemories([{ assets: [recentImage] }]).length, 1);
});

test('merges multiple albums, preserves their names and deduplicates shared photos', async () => {
  const client = {
    async getAlbum(albumId) {
      return {
        albumName: albumId === 'album-family' ? 'Family' : 'Holidays',
      };
    },
    async getAlbumAssets(albumIds, { size }) {
      assert.deepEqual(albumIds, ['album-family', 'album-holidays']);
      assert.equal(size, 10);
      return [olderImage, recentImage, { ...recentImage }];
    },
  };
  const provider = new ImmichPhotoProvider({ client, locale: 'en-GB' });

  const result = await provider.resolve({
    source_mode: SOURCE_MODES.ALBUM,
    album_ids: ['album-family', 'album-holidays'],
    random_order: false,
    max_assets: 10,
  });

  assert.equal(result.sourceName, 'Albums — Family, Holidays');
  assert.equal(result.totalImageCount, 2);
  assert.deepEqual(
    result.photos.map((photo) => photo.id),
    ['image-recent', 'image-old'],
  );
});
