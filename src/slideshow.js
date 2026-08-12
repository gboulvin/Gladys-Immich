// -----------------------------------------------------------------------------
// Stateful slideshow orchestrator.
//
// The asset list is refreshed on a separate cadence from slide publication.
// This keeps the dashboard responsive and prevents an album of hundreds of
// images from triggering hundreds of downloads on every cycle.
// -----------------------------------------------------------------------------

import { ImmichClient } from './immichClient.js';
import { toCameraImage, asGladysCameraImage } from './imageTransformer.js';
import { ImmichPhotoProvider } from './photoProvider.js';

export class EmptyPhotoSourceError extends Error {
  constructor(sourceName) {
    super(`No images are available in “${sourceName}”.`);
    this.name = 'EmptyPhotoSourceError';
    this.code = 'EMPTY_SOURCE';
  }
}

function sourceKey(config) {
  return JSON.stringify({
    immich_url: config.immich_url,
    api_key: config.api_key,
    source_mode: config.source_mode,
    album_id: config.album_id,
    max_assets: config.max_assets,
    random_order: config.random_order,
  });
}

export class ImmichSlideshow {
  constructor({
    clientFactory = (config) =>
      new ImmichClient({ baseUrl: config.immich_url, apiKey: config.api_key }),
    imageTransformer = toCameraImage,
    now = () => Date.now(),
  } = {}) {
    this.clientFactory = clientFactory;
    this.imageTransformer = imageTransformer;
    this.now = now;
    this.key = null;
    this.provider = null;
    this.photos = [];
    this.sourceName = '';
    this.totalImageCount = 0;
    this.refreshedAt = 0;
    this.nextIndex = 0;
    this.refreshPromise = null;
  }

  reset() {
    this.key = null;
    this.provider = null;
    this.photos = [];
    this.sourceName = '';
    this.totalImageCount = 0;
    this.refreshedAt = 0;
    this.nextIndex = 0;
    this.refreshPromise = null;
  }

  getStatus() {
    return {
      sourceName: this.sourceName,
      totalImageCount: this.totalImageCount,
      loadedImageCount: this.photos.length,
      refreshedAt: this.refreshedAt || null,
    };
  }

  isStale(config) {
    return this.now() - this.refreshedAt >= config.source_refresh_interval * 1_000;
  }

  async testConnection(config) {
    const client = this.clientFactory(config);
    return client.testConnection();
  }

  async refresh(config, { force = false } = {}) {
    const newKey = sourceKey(config);
    const mustRefresh = force || newKey !== this.key || !this.provider || this.isStale(config);
    if (!mustRefresh) {
      return this.getStatus();
    }

    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      const client = this.clientFactory(config);
      const provider = new ImmichPhotoProvider({ client });
      const result = await provider.resolve(config);

      this.key = newKey;
      this.provider = provider;
      this.photos = result.photos;
      this.sourceName = result.sourceName;
      this.totalImageCount = result.totalImageCount;
      this.refreshedAt = this.now();
      this.nextIndex = 0;
      return this.getStatus();
    })();

    try {
      return await this.refreshPromise;
    } finally {
      this.refreshPromise = null;
    }
  }

  async next(config) {
    await this.refresh(config);

    if (this.photos.length === 0) {
      throw new EmptyPhotoSourceError(this.sourceName || 'Immich source');
    }

    const photo = this.photos[this.nextIndex];
    this.nextIndex = (this.nextIndex + 1) % this.photos.length;
    const preview = await this.provider.getPreview(photo.id);
    const cameraImage = await this.imageTransformer(preview.buffer);

    return {
      ...photo,
      sourceName: this.sourceName,
      image: asGladysCameraImage(cameraImage),
    };
  }
}
