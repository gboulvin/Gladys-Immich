import assert from 'node:assert/strict';
import test from 'node:test';
import { ImmichApiError, ImmichClient } from '../src/immichClient.js';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('lists albums with the Immich API key and normalized API path', async () => {
  const calls = [];
  const client = new ImmichClient({
    baseUrl: 'http://immich.local:2283',
    apiKey: 'key-123',
    fetchImpl: async (url, options) => {
      calls.push({ url: url.toString(), options });
      return jsonResponse([{ id: 'album-1', albumName: 'Family' }]);
    },
  });

  const albums = await client.listAlbums();

  assert.deepEqual(albums, [{ id: 'album-1', albumName: 'Family' }]);
  assert.equal(calls[0].url, 'http://immich.local:2283/api/albums');
  assert.equal(calls[0].options.headers['x-api-key'], 'key-123');
  assert.equal(calls[0].options.headers.accept, 'application/json');
});

test('adds the on-this-day query and exposes permission failures clearly', async () => {
  const client = new ImmichClient({
    baseUrl: 'https://immich.example.test',
    apiKey: 'bad-key',
    fetchImpl: async (url) => {
      assert.equal(url.searchParams.get('type'), 'on_this_day');
      assert.equal(url.searchParams.get('size'), '100');
      return new Response('Unauthorized', { status: 401 });
    },
  });

  await assert.rejects(client.getOnThisDayMemories(), (error) => {
    assert.ok(error instanceof ImmichApiError);
    assert.equal(error.status, 401);
    assert.match(error.message, /API key/);
    return true;
  });
});

test('retrieves only image previews as buffers', async () => {
  const client = new ImmichClient({
    baseUrl: 'https://immich.example.test',
    apiKey: 'key',
    fetchImpl: async (url, options) => {
      assert.equal(url.pathname, '/api/assets/asset-1/thumbnail');
      assert.equal(url.searchParams.get('size'), 'preview');
      assert.equal(options.headers.accept, 'image/*');
      return new Response(Buffer.from([1, 2, 3]), {
        status: 200,
        headers: { 'content-type': 'image/webp' },
      });
    },
  });

  const preview = await client.getPreview('asset-1');

  assert.equal(preview.contentType, 'image/webp');
  assert.deepEqual(preview.buffer, Buffer.from([1, 2, 3]));
});

test('rejects non-image preview responses', async () => {
  const client = new ImmichClient({
    baseUrl: 'https://immich.example.test',
    apiKey: 'key',
    fetchImpl: async () => new Response('not an image', { status: 200 }),
  });

  await assert.rejects(client.getPreview('asset-1'), (error) => error.code === 'INVALID_IMAGE');
});

test('retrieves album assets through the metadata-search endpoint', async () => {
  const client = new ImmichClient({
    baseUrl: 'https://immich.example.test/library',
    apiKey: 'key',
    fetchImpl: async (url, options) => {
      assert.equal(url.pathname, '/library/api/search/metadata');
      assert.equal(options.method, 'POST');
      assert.equal(options.headers['x-api-key'], 'key');
      assert.equal(options.headers['content-type'], 'application/json');
      assert.deepEqual(JSON.parse(options.body), {
        albumIds: ['album-1'],
        size: 25,
        page: 1,
        withExif: true,
      });
      return jsonResponse({
        assets: {
          count: 1,
          items: [{ id: 'asset-1', type: 'IMAGE' }],
          nextPage: null,
          total: 1,
        },
      });
    },
  });

  const assets = await client.getAlbumAssets('album-1', { size: 25 });

  assert.deepEqual(assets, [{ id: 'asset-1', type: 'IMAGE' }]);
});

test('retrieves the union of multiple album IDs in one metadata search', async () => {
  const client = new ImmichClient({
    baseUrl: 'https://immich.example.test',
    apiKey: 'key',
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.deepEqual(body.albumIds, ['album-1', 'album-2']);
      return jsonResponse({ assets: { items: [] } });
    },
  });

  const assets = await client.getAlbumAssets(['album-1', 'album-2', 'album-1']);

  assert.deepEqual(assets, []);
});
