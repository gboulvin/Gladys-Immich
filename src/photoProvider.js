// -----------------------------------------------------------------------------
// Immich photo-source domain layer.
//
// This module is intentionally independent from the Gladys SDK. It provides a
// small, tested contract that can power the current virtual-camera dashboard
// display and a future native Gladys Photo widget provider without duplicating
// any Immich-specific logic.
// -----------------------------------------------------------------------------

import { SOURCE_MODES } from './config.js';

function asArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (Array.isArray(value?.items)) {
    return value.items;
  }
  return [];
}

function assetDate(asset) {
  const candidate =
    asset.fileCreatedAt ??
    asset.localDateTime ??
    asset.exifInfo?.dateTimeOriginal ??
    asset.createdAt;
  const date = candidate ? new Date(candidate) : null;
  return date && !Number.isNaN(date.valueOf()) ? date : null;
}

function compareMostRecentFirst(left, right) {
  return (assetDate(right)?.valueOf() ?? 0) - (assetDate(left)?.valueOf() ?? 0);
}

function shuffle(items, random = Math.random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const chosen = Math.floor(random() * (index + 1));
    [result[index], result[chosen]] = [result[chosen], result[index]];
  }
  return result;
}

function formatDate(value, locale = 'fr-FR') {
  const date = assetDate({ fileCreatedAt: value });
  if (!date) {
    return '';
  }
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/**
 * Generate a short human-readable caption from the metadata commonly supplied
 * by Immich. The function omits unavailable information rather than inventing
 * it, and the caller may disable captions in its dashboard presentation.
 */
export function buildCaption(asset, locale = 'fr-FR') {
  const description = asset.exifInfo?.description?.trim() || asset.description?.trim();
  const location = [asset.exifInfo?.city, asset.exifInfo?.state, asset.exifInfo?.country]
    .filter(Boolean)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
  const date = formatDate(
    asset.exifInfo?.dateTimeOriginal ?? asset.fileCreatedAt ?? asset.localDateTime,
    locale,
  );

  const parts = [description, location, date].filter(Boolean);
  return parts.join(' — ');
}

/** Return the direct asset array regardless of minor Immich response variants. */
export function assetsFromMemories(memories) {
  return memories.flatMap((memory) => asArray(memory.assets ?? memory.data?.assets));
}

export function isImage(asset) {
  return String(asset?.type ?? asset?.mediaType ?? '').toUpperCase() === 'IMAGE';
}

/**
 * Resolve an Immich source into the standardized photo metadata required by a
 * slideshow. Preview bytes are deliberately fetched only when the next slide
 * is displayed; large albums therefore do not trigger many image downloads.
 */
export class ImmichPhotoProvider {
  constructor({ client, random = Math.random, locale = 'fr-FR' }) {
    this.client = client;
    this.random = random;
    this.locale = locale;
  }

  async listAlbums() {
    const albums = await this.client.listAlbums();
    return albums.map((album) => ({
      id: album.id,
      name: album.albumName ?? album.name ?? album.id,
      assetCount: Number(album.assetCount ?? 0),
    }));
  }

  async resolve(config) {
    let assets;
    let sourceName;

    if (config.source_mode === SOURCE_MODES.MEMORIES) {
      const memories = await this.client.getOnThisDayMemories();
      assets = assetsFromMemories(memories);
      sourceName = 'Memories — on this day';
    } else {
      const album = await this.client.getAlbum(config.album_id);
      sourceName = album.albumName ?? config.album_id;
      try {
        assets = await this.client.getAlbumAssets(config.album_id, { size: config.max_assets });
      } catch (error) {
        // Older Immich servers returned the assets inline on the album object.
        // Keep that compatibility path, but do not hide modern API failures.
        const legacyAssets = asArray(album.assets);
        if (error?.status === 404 && legacyAssets.length > 0) {
          assets = legacyAssets;
        } else {
          throw error;
        }
      }
    }

    // Albums and memory groups can overlap. Preserve just one entry per UUID.
    const uniqueImages = [
      ...new Map(assets.filter(isImage).map((asset) => [asset.id, asset])).values(),
    ];
    const ordered = config.random_order
      ? shuffle(uniqueImages, this.random)
      : uniqueImages.sort(compareMostRecentFirst);

    return {
      sourceName,
      totalImageCount: uniqueImages.length,
      photos: ordered.slice(0, config.max_assets).map((asset) => ({
        id: asset.id,
        originalFileName: asset.originalFileName ?? '',
        createdAt: assetDate(asset)?.toISOString() ?? null,
        caption: buildCaption(asset, this.locale),
      })),
    };
  }

  async getPreview(assetId) {
    return this.client.getPreview(assetId);
  }
}
