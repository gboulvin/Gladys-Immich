// -----------------------------------------------------------------------------
// Small, dependency-free Immich REST client.
//
// Immich is self-hosted, so requests deliberately use only the server URL and
// API key supplied by the Gladys administrator. No photo or credential leaves
// the user's own network except when their Immich server itself is remote.
// -----------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 15_000;
const MAX_ALBUM_ASSETS = 500;

export class ImmichApiError extends Error {
  constructor(message, { status, code, cause } = {}) {
    super(message, { cause });
    this.name = 'ImmichApiError';
    this.status = status;
    this.code = code;
  }
}

function urlFor(baseUrl, path, query = {}) {
  // Keep an optional reverse-proxy prefix (for example /immich) instead of
  // resolving `/api` from the host root.
  const root = String(baseUrl).replace(/\/+$/, '');
  const url = new URL(`${root}/api${path}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function errorMessageFor(status, fallback) {
  if (status === 401 || status === 403) {
    return 'Immich rejected the API key or its permissions.';
  }
  if (status === 404) {
    return 'The requested Immich resource was not found.';
  }
  return fallback;
}

function extractSearchAssets(payload) {
  const assets = payload?.assets?.items ?? payload?.assets ?? payload?.items;
  if (!Array.isArray(assets)) {
    throw new ImmichApiError('Immich returned an invalid album asset list.', {
      code: 'INVALID_ALBUM_ASSETS',
    });
  }
  return assets;
}

/**
 * Client for the endpoints required by the slideshow: albums, asset search,
 * memories and preview thumbnails.
 */
export class ImmichClient {
  constructor({ baseUrl, apiKey, fetchImpl = fetch }) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
  }

  async request(path, { query, body, responseType = 'json' } = {}) {
    let response;
    try {
      response = await this.fetch(urlFor(this.baseUrl, path, query), {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'x-api-key': this.apiKey,
          accept: responseType === 'json' ? 'application/json' : 'image/*',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      const isTimeout = cause?.name === 'TimeoutError';
      throw new ImmichApiError(
        isTimeout
          ? 'Immich did not respond before the request timeout.'
          : 'Unable to reach the Immich server.',
        { code: isTimeout ? 'TIMEOUT' : 'UNREACHABLE', cause },
      );
    }

    if (!response.ok) {
      let detail = '';
      try {
        detail = (await response.text()).slice(0, 300);
      } catch {
        // The HTTP status already carries a useful, stable diagnostic.
      }
      throw new ImmichApiError(
        errorMessageFor(response.status, `Immich returned HTTP ${response.status}.`),
        {
          status: response.status,
          code: 'HTTP_ERROR',
          cause: detail ? new Error(detail) : undefined,
        },
      );
    }

    if (responseType === 'buffer') {
      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      if (!contentType.startsWith('image/')) {
        throw new ImmichApiError('Immich returned a non-image response for a preview.', {
          code: 'INVALID_IMAGE',
        });
      }
      return {
        contentType,
        buffer: Buffer.from(await response.arrayBuffer()),
      };
    }

    try {
      return await response.json();
    } catch (cause) {
      throw new ImmichApiError('Immich returned an invalid JSON response.', {
        code: 'INVALID_JSON',
        cause,
      });
    }
  }

  /** Validate server address, API key and `album.read` permission. */
  async testConnection() {
    const albums = await this.listAlbums();
    return { albumCount: albums.length };
  }

  async listAlbums() {
    const albums = await this.request('/albums');
    if (!Array.isArray(albums)) {
      throw new ImmichApiError('Immich returned an invalid album list.', {
        code: 'INVALID_ALBUMS',
      });
    }
    return albums;
  }

  async getAlbum(albumId) {
    return this.request(`/albums/${encodeURIComponent(albumId)}`);
  }

  /**
   * Immich v2 album responses contain album metadata only. Assets therefore
   * come from the stable metadata-search endpoint filtered by `albumIds`.
   * A cap matches the integration configuration maximum and avoids loading an
   * entire large album before the slideshow starts.
   */
  async getAlbumAssets(albumId, { size = MAX_ALBUM_ASSETS } = {}) {
    const payload = await this.request('/search/metadata', {
      body: {
        albumIds: [albumId],
        size: Math.min(Math.max(1, Number(size) || MAX_ALBUM_ASSETS), MAX_ALBUM_ASSETS),
        page: 1,
        withExif: true,
      },
    });
    return extractSearchAssets(payload);
  }

  /** Retrieve only on-this-day memories and let Immich calculate today locally. */
  async getOnThisDayMemories() {
    const memories = await this.request('/memories', {
      query: { type: 'on_this_day', size: 100 },
    });
    if (!Array.isArray(memories)) {
      throw new ImmichApiError('Immich returned an invalid memory list.', {
        code: 'INVALID_MEMORIES',
      });
    }
    return memories;
  }

  /** Download Immich's preview rendition, never the original asset. */
  async getPreview(assetId) {
    return this.request(`/assets/${encodeURIComponent(assetId)}/thumbnail`, {
      query: { size: 'preview' },
      responseType: 'buffer',
    });
  }
}
