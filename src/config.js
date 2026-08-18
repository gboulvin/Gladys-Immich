// -----------------------------------------------------------------------------
// Configuration normalization for the Immich slideshow integration.
//
// Gladys stores a single configuration form per integration. The form therefore
// exposes two complete slideshow profiles; each profile is bound to one virtual
// camera device and keeps its own Immich server, source and display settings.
// -----------------------------------------------------------------------------

export const SOURCE_MODES = Object.freeze({
  ALBUM: 'album',
  MEMORIES: 'memories',
});

export const SECONDARY_PROFILE_SUFFIX = '_2';

const PROFILE_KEYS = Object.freeze([
  'immich_url',
  'api_key',
  'source_mode',
  'album_id',
  'album_ids',
  'slide_interval',
  'source_refresh_interval',
  'max_assets',
  'random_order',
  'show_caption',
]);

const DEFAULT_SLIDESHOW_CONFIG = Object.freeze({
  immich_url: '',
  api_key: '',
  source_mode: SOURCE_MODES.ALBUM,
  album_id: '',
  album_ids: [],
  slide_interval: 60,
  source_refresh_interval: 3_600,
  max_assets: 200,
  random_order: false,
  show_caption: false,
});

function keyForProfile(key, suffix = '') {
  return `${key}${suffix}`;
}

function withSuffix(profile, suffix = '') {
  return Object.fromEntries(PROFILE_KEYS.map((key) => [keyForProfile(key, suffix), profile[key]]));
}

/** Defaults for every field stored by the Gladys configuration form. */
export const DEFAULT_CONFIG = Object.freeze({
  ...DEFAULT_SLIDESHOW_CONFIG,
  ...withSuffix(DEFAULT_SLIDESHOW_CONFIG, SECONDARY_PROFILE_SUFFIX),
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

/** Parse a comma- or line-separated album list while preserving input order. */
export function normalizeAlbumIds(value) {
  const candidates = Array.isArray(value) ? value : [value];
  const ids = candidates.flatMap((candidate) =>
    String(candidate ?? '')
      .split(/[\n,;]+/)
      .map((id) => id.trim())
      .filter(Boolean),
  );
  return [...new Set(ids)];
}

function normalizeSlideshowProfile(raw, suffix = '') {
  const sourceMode =
    raw[keyForProfile('source_mode', suffix)] === SOURCE_MODES.MEMORIES
      ? SOURCE_MODES.MEMORIES
      : SOURCE_MODES.ALBUM;
  const albumIds = normalizeAlbumIds(raw[keyForProfile('album_id', suffix)]);

  return {
    ...DEFAULT_SLIDESHOW_CONFIG,
    immich_url: normalizeUrl(raw[keyForProfile('immich_url', suffix)]),
    api_key:
      typeof raw[keyForProfile('api_key', suffix)] === 'string'
        ? raw[keyForProfile('api_key', suffix)].trim()
        : '',
    source_mode: sourceMode,
    // Keep the historical key so existing Gladys configurations remain usable.
    album_id: albumIds.join(', '),
    album_ids: albumIds,
    slide_interval: clampInteger(
      raw[keyForProfile('slide_interval', suffix)],
      DEFAULT_SLIDESHOW_CONFIG.slide_interval,
      MIN_SLIDE_INTERVAL_SECONDS,
      MAX_SLIDE_INTERVAL_SECONDS,
    ),
    source_refresh_interval: clampInteger(
      raw[keyForProfile('source_refresh_interval', suffix)],
      DEFAULT_SLIDESHOW_CONFIG.source_refresh_interval,
      MIN_SOURCE_REFRESH_INTERVAL_SECONDS,
      MAX_SOURCE_REFRESH_INTERVAL_SECONDS,
    ),
    max_assets: clampInteger(
      raw[keyForProfile('max_assets', suffix)],
      DEFAULT_SLIDESHOW_CONFIG.max_assets,
      MIN_MAX_ASSETS,
      MAX_MAX_ASSETS,
    ),
    random_order:
      raw[keyForProfile('random_order', suffix)] === true ||
      raw[keyForProfile('random_order', suffix)] === 'true',
    show_caption:
      raw[keyForProfile('show_caption', suffix)] === true ||
      raw[keyForProfile('show_caption', suffix)] === 'true',
  };
}

/**
 * Merge user-entered values with safe defaults and normalize every type.
 * @param {Record<string, unknown>} raw Raw config returned by the Gladys SDK.
 * @returns {typeof DEFAULT_CONFIG}
 */
export function normalizeConfig(raw = {}) {
  const primary = normalizeSlideshowProfile(raw);
  const secondary = normalizeSlideshowProfile(raw, SECONDARY_PROFILE_SUFFIX);

  return {
    ...DEFAULT_CONFIG,
    ...primary,
    ...withSuffix(secondary, SECONDARY_PROFILE_SUFFIX),
  };
}

/**
 * Return the normalized settings bound to one virtual camera.
 * @param {typeof DEFAULT_CONFIG} config Complete integration configuration.
 * @param {number} profileNumber 1 for the historical camera, 2 for the second camera.
 */
export function getSlideshowConfig(config, profileNumber = 1) {
  const suffix = profileNumber === 2 ? SECONDARY_PROFILE_SUFFIX : '';
  return Object.fromEntries(
    PROFILE_KEYS.map((key) => [
      key,
      config?.[keyForProfile(key, suffix)] ?? DEFAULT_SLIDESHOW_CONFIG[key],
    ]),
  );
}

/** True when the user started configuring this slideshow profile. */
export function hasSlideshowConfiguration(config) {
  return Boolean(config?.immich_url || config?.api_key || config?.album_id);
}

/** Return a localized error when the server URL or API key is unavailable. */
export function validateConnectionConfig(config) {
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
  return null;
}

/**
 * Return an actionable, localized configuration problem or null when ready.
 * @param {ReturnType<typeof getSlideshowConfig>} config
 */
export function validateConfig(config) {
  const connectionProblem = validateConnectionConfig(config);
  if (connectionProblem) {
    return connectionProblem;
  }
  if (config.source_mode === SOURCE_MODES.ALBUM && config.album_ids.length === 0) {
    return {
      en: 'Enter at least one Immich album UUID to display.',
      fr: 'Saisissez au moins un UUID d’album Immich à afficher.',
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
