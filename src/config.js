// -----------------------------------------------------------------------------
// Configuration normalization for the Immich slideshow integration.
//
// Values are collected by the Gladys configuration form declared in the
// manifest. Keeping normalization here gives the rest of the integration
// predictable, typed values and prevents invalid settings from reaching Immich.
// -----------------------------------------------------------------------------

export const SOURCE_MODES = Object.freeze({
  ALBUM: 'album',
  MEMORIES: 'memories',
});

export const DEFAULT_CONFIG = Object.freeze({
  immich_url: '',
  api_key: '',
  source_mode: SOURCE_MODES.ALBUM,
  album_id: '',
  slide_interval: 60,
  source_refresh_interval: 3_600,
  max_assets: 200,
  random_order: false,
});

// Gladys camera images are capped at 12 updates/minute; keep a margin over 5 s.
const MIN_SLIDE_INTERVAL_SECONDS = 10;
const MAX_SLIDE_INTERVAL_SECONDS = 3_600;
const MIN_SOURCE_REFRESH_INTERVAL_SECONDS = 300;
const MAX_SOURCE_REFRESH_INTERVAL_SECONDS = 86_400;
const MIN_MAX_ASSETS = 1;
const MAX_MAX_ASSETS = 500;

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, parsed));
}

function normalizeUrl(value) {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '';
  }

  try {
    const url = new URL(trimmed);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return '';
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return '';
  }
}

/**
 * Merge user-entered values with safe defaults and normalize every type.
 * @param {Record<string, unknown>} raw Raw config returned by the Gladys SDK.
 * @returns {typeof DEFAULT_CONFIG}
 */
export function normalizeConfig(raw = {}) {
  const sourceMode =
    raw.source_mode === SOURCE_MODES.MEMORIES ? SOURCE_MODES.MEMORIES : SOURCE_MODES.ALBUM;

  return {
    ...DEFAULT_CONFIG,
    immich_url: normalizeUrl(raw.immich_url),
    api_key: typeof raw.api_key === 'string' ? raw.api_key.trim() : '',
    source_mode: sourceMode,
    album_id: typeof raw.album_id === 'string' ? raw.album_id.trim() : '',
    slide_interval: clampInteger(
      raw.slide_interval,
      DEFAULT_CONFIG.slide_interval,
      MIN_SLIDE_INTERVAL_SECONDS,
      MAX_SLIDE_INTERVAL_SECONDS,
    ),
    source_refresh_interval: clampInteger(
      raw.source_refresh_interval,
      DEFAULT_CONFIG.source_refresh_interval,
      MIN_SOURCE_REFRESH_INTERVAL_SECONDS,
      MAX_SOURCE_REFRESH_INTERVAL_SECONDS,
    ),
    max_assets: clampInteger(
      raw.max_assets,
      DEFAULT_CONFIG.max_assets,
      MIN_MAX_ASSETS,
      MAX_MAX_ASSETS,
    ),
    random_order: raw.random_order === true || raw.random_order === 'true',
  };
}

/**
 * Return an actionable, localized configuration problem or null when ready.
 * @param {ReturnType<typeof normalizeConfig>} config
 */
export function validateConfig(config) {
  if (!config.immich_url) {
    return {
      en: 'Enter a valid Immich server URL (http:// or https://).',
      fr: 'Saisissez une URL de serveur Immich valide (http:// ou https://).',
    };
  }
  if (!config.api_key) {
    return {
      en: 'Enter an Immich API key with album, asset, and memory read access.',
      fr: 'Saisissez une clé API Immich avec les droits de lecture des albums, médias et souvenirs.',
    };
  }
  if (config.source_mode === SOURCE_MODES.ALBUM && !config.album_id) {
    return {
      en: 'Enter the UUID of the Immich album to display.',
      fr: 'Saisissez l’UUID de l’album Immich à afficher.',
    };
  }
  return null;
}

export const CONFIG_LIMITS = Object.freeze({
  minSlideIntervalSeconds: MIN_SLIDE_INTERVAL_SECONDS,
  maxSlideIntervalSeconds: MAX_SLIDE_INTERVAL_SECONDS,
  minSourceRefreshIntervalSeconds: MIN_SOURCE_REFRESH_INTERVAL_SECONDS,
  maxSourceRefreshIntervalSeconds: MAX_SOURCE_REFRESH_INTERVAL_SECONDS,
  minMaxAssets: MIN_MAX_ASSETS,
  maxMaxAssets: MAX_MAX_ASSETS,
});
