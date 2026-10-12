// -----------------------------------------------------------------------------
// Virtual Gladys cameras backed by independent Immich slideshows.
// -----------------------------------------------------------------------------

import {
  createLogger,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
  DEVICE_TRANSPORTS,
} from '@gladysassistant/integration-sdk';
import {
  getSlideshowConfig,
  hasSlideshowConfiguration,
  validateConfig,
  validateConnectionConfig,
} from '../config.js';
import { EmptyPhotoSourceError, ImmichSlideshow } from '../slideshow.js';
import { transportForUrl } from '../transport.js';

const DEVICE_TYPE = 'camera';
const RECENT_SLIDES = 3;
const FEATURE = { IMAGE: 'image' };
const logger = createLogger({ name: 'immich-slideshow' });

/** True when the Immich server could not be reached at all. */
export function isNetworkError(error) {
  return error?.code === 'UNREACHABLE' || error?.code === 'TIMEOUT';
}

/** Localized, user-facing explanation of a slideshow failure. */
export function errorMessage(error) {
  if (error?.localizedMessage) {
    return error.localizedMessage;
  }
  if (error instanceof EmptyPhotoSourceError) {
    return {
      en: 'The selected Immich source contains no images.',
      fr: 'La source Immich sélectionnée ne contient aucune image.',
    };
  }
  if (error?.status === 401 || error?.status === 403) {
    return {
      en: 'Immich rejected the API key or its permissions.',
      fr: 'Immich a refusé la clé API ou ses permissions.',
    };
  }
  if (isNetworkError(error)) {
    return {
      en: 'The Immich server is unreachable. Check its URL and network access from Gladys.',
      fr: 'Le serveur Immich est inaccessible. Vérifiez son URL et l’accès réseau depuis Gladys.',
    };
  }
  return {
    en: 'Unable to retrieve an Immich preview. See the integration logs for details.',
    fr: 'Impossible de récupérer un aperçu Immich. Consultez les journaux de l’intégration.',
  };
}

/**
 * Image key of a slide for the dashboard widget. The core caches a widget
 * image one hour BY KEY, so the key changes whenever the bytes do: another
 * asset, or the caption band switched on or off.
 */
export function widgetImageKey(profileNumber, slide, config) {
  const caption = getSlideshowConfig(config, profileNumber).show_caption ? 'c' : '';
  const assetId = String(slide.id)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .slice(0, 48);
  return `slide-${profileNumber}${caption}-${assetId}`;
}

function throwConfigProblem(problem) {
  if (problem) {
    const error = new Error(problem.en);
    error.localizedMessage = problem;
    throw error;
  }
}

/**
 * Build one independent virtual camera.
 *
 * The first camera keeps the historical stable external identifier. The second
 * camera has its own identifier, configuration profile and ImmichSlideshow
 * instance, so its cache, rotation index and timers never overlap with the
 * first dashboard slideshow.
 *
 * The manifest action keys follow the same rule: the first camera keeps the
 * historical `test_connection` / `list_albums` / `refresh_now`, the second one
 * answers the `_2` variants.
 */
export function createSlideshowCamera({
  key,
  platformDeviceId,
  profileNumber,
  name,
  slideshow = new ImmichSlideshow(),
}) {
  const label = profileNumber === 1 ? 'Immich slideshow' : `Immich slideshow ${profileNumber}`;
  const actionSuffix = profileNumber === 1 ? '' : `_${profileNumber}`;
  // The last slides shown, newest first, so the dashboard widget can serve the
  // image it just declared even if the camera moved on in the meantime.
  let recentSlides = [];

  function remember(slide, config) {
    const entry = { ...slide, imageKey: widgetImageKey(profileNumber, slide, config) };
    recentSlides = [entry, ...recentSlides.filter((item) => item.imageKey !== entry.imageKey)];
    recentSlides = recentSlides.slice(0, RECENT_SLIDES);
    return entry;
  }

  function profileFrom(config) {
    return getSlideshowConfig(config, profileNumber);
  }

  function assertConfigured(config) {
    throwConfigProblem(validateConfig(profileFrom(config)));
  }

  function assertConnectionConfigured(config) {
    throwConfigProblem(validateConnectionConfig(profileFrom(config)));
  }

  async function publishNextSlide(gladys, config) {
    const profile = profileFrom(config);
    assertConfigured(config);
    const slide = await slideshow.next(profile);
    const ids = gladys.externalIds(DEVICE_TYPE, platformDeviceId);
    await gladys.publishCameraImage(ids.device, slide.image);
    logger.info(
      `Published “${slide.originalFileName || slide.id}” from ${slide.sourceName} on ${label}`,
    );
    return remember(slide, config);
  }

  const blueprint = {
    key,
    profileNumber,

    deviceExternalId(gladys) {
      return gladys.externalIds(DEVICE_TYPE, platformDeviceId).device;
    },

    buildDevice(gladys) {
      const ids = gladys.externalIds(DEVICE_TYPE, platformDeviceId);
      return {
        name,
        external_id: ids.device,
        features: [
          {
            name: 'Image',
            external_id: ids.feature(FEATURE.IMAGE),
            category: DEVICE_FEATURE_CATEGORIES.CAMERA,
            type: DEVICE_FEATURE_TYPES.CAMERA.IMAGE,
            read_only: true,
            has_feedback: false,
            keep_history: false,
            // Gladys requires numeric bounds for every DeviceFeature, including
            // camera images carried by the dedicated image channel.
            min: 0,
            max: 1,
          },
        ],
      };
    },

    async onGetImage(_gladys, { config }) {
      const profile = profileFrom(config);
      assertConfigured(config);
      const slide = await slideshow.next(profile);
      logger.info(
        `On-demand slide “${slide.originalFileName || slide.id}” from ${slide.sourceName} on ${label}`,
      );
      remember(slide, config);
      return slide.image;
    },

    /**
     * Start the dashboard feed and return its mandatory cleanup callback.
     * `onHealth(error | null)` is told the outcome of every publication, so
     * the caller can update the connection status and the transport badge
     * when the slideshow breaks or recovers.
     */
    startPush(gladys, config, { onHealth = () => {}, onSlide = () => {} } = {}) {
      const profile = profileFrom(config);
      if (validateConfig(profile)) {
        if (hasSlideshowConfiguration(profile)) {
          logger.info(`${label} is waiting for a complete Immich configuration.`);
        }
        return () => {};
      }

      let stopped = false;
      const publish = async () => {
        if (stopped) {
          return;
        }
        try {
          const slide = await publishNextSlide(gladys, config);
          await onHealth(null);
          onSlide(slide);
        } catch (error) {
          logger.error(`Failed to publish the next Immich slide on ${label}`, error);
          await Promise.resolve(onHealth(error)).catch((healthError) =>
            logger.error(`Failed to report the health of ${label}`, healthError),
          );
        }
      };

      // Publish immediately; users do not wait for the first interval to elapse.
      void publish();
      const interval = setInterval(() => void publish(), profile.slide_interval * 1_000);

      return () => {
        stopped = true;
        clearInterval(interval);
      };
    },

    reset() {
      slideshow.reset();
      recentSlides = [];
    },

    /** Publish the next slide on this camera now (widget and scene actions). */
    async showNext(gladys, { config }) {
      return publishNextSlide(gladys, config);
    },

    /** The slide on display, or null before the first one. */
    currentSlide() {
      return recentSlides[0] ?? null;
    },

    /** Raw base64 JPEG of a recent slide, for the dashboard widget. */
    widgetImage(imageKey) {
      const slide = recentSlides.find((item) => item.imageKey === imageKey);
      return slide ? slide.image.slice(slide.image.indexOf(',') + 1) : null;
    },

    isReady(config) {
      return !validateConfig(profileFrom(config));
    },

    isConfigured(config) {
      return hasSlideshowConfiguration(profileFrom(config));
    },

    profile(config) {
      return profileFrom(config);
    },

    async testConnection(_gladys, { config }) {
      const profile = profileFrom(config);
      assertConfigured(config);
      const { albumCount } = await slideshow.testConnection(profile);
      return {
        en: `Immich connection successful. ${albumCount} album${albumCount === 1 ? '' : 's'} found.`,
        fr: `Connexion Immich réussie. ${albumCount} album${albumCount === 1 ? '' : 's'} trouvé${albumCount === 1 ? '' : 's'}.`,
      };
    },

    async listAlbums(_gladys, { config }) {
      const profile = profileFrom(config);
      assertConnectionConfigured(config);
      const albums = await slideshow.listAlbums(profile);
      const displayedAlbums = albums.slice(0, 50);
      const lines = displayedAlbums.map(
        (album) =>
          `• ${album.name} — ${album.id}${album.assetCount ? ` (${album.assetCount})` : ''}`,
      );
      const suffix =
        albums.length > displayedAlbums.length
          ? `\n… +${albums.length - displayedAlbums.length}`
          : '';

      return {
        en: `Found ${albums.length} album${albums.length === 1 ? '' : 's'}. Copy the UUID of the chosen album:\n${lines.join('\n')}${suffix}`,
        fr: `${albums.length} album${albums.length === 1 ? '' : 's'} trouvé${albums.length === 1 ? '' : 's'}. Copiez l’UUID de l’album choisi :\n${lines.join('\n')}${suffix}`,
      };
    },

    async refreshNow(gladys, { config }) {
      const profile = profileFrom(config);
      assertConfigured(config);
      await slideshow.refresh(profile, { force: true });
      const slide = await publishNextSlide(gladys, config);
      return {
        en: `Immich source refreshed. Displaying ${slide.originalFileName || 'the next image'}.`,
        fr: `Source Immich actualisée. Affichage de ${slide.originalFileName || 'la prochaine image'}.`,
      };
    },

    /**
     * Transport badge of this camera, or null when the slideshow is not
     * configured at all (no badge to show).
     * @param {object} config Complete integration configuration.
     * @param {Error | null | undefined} lastError Outcome of the last Immich
     *   call: null when it worked, undefined when nothing ran yet.
     */
    transport(config, lastError) {
      const profile = profileFrom(config);
      if (!hasSlideshowConfiguration(profile)) {
        return null;
      }
      const problem = validateConfig(profile);
      if (problem) {
        // Without a usable URL there is nothing to reach; with one, the
        // missing piece (key, album) is the reason the slideshow is idle.
        return profile.immich_url
          ? { transport: transportForUrl(profile.immich_url), degraded: true, message: problem }
          : { transport: DEVICE_TRANSPORTS.UNREACHABLE };
      }
      if (lastError && isNetworkError(lastError)) {
        return { transport: DEVICE_TRANSPORTS.UNREACHABLE };
      }
      const transport = transportForUrl(profile.immich_url);
      if (lastError) {
        // Immich answers, but the slideshow cannot run (key revoked, empty
        // album...): reachable, not nominal.
        return { transport, degraded: true, message: errorMessage(lastError) };
      }
      return { transport };
    },

    getStatus() {
      return slideshow.getStatus();
    },

    errorMessage,
  };

  // Manifest action handlers, registered by key (see src/app.js).
  blueprint.actions = {
    [`test_connection${actionSuffix}`]: (gladys, context) =>
      blueprint.testConnection(gladys, context),
    [`list_albums${actionSuffix}`]: (gladys, context) => blueprint.listAlbums(gladys, context),
    [`refresh_now${actionSuffix}`]: (gladys, context) => blueprint.refreshNow(gladys, context),
  };

  return blueprint;
}

// Keep the original external id for backward compatibility with existing users.
export const slideshowCamera = createSlideshowCamera({
  key: 'immich-slideshow-camera',
  platformDeviceId: 'immich-slideshow',
  profileNumber: 1,
  name: 'Immich slideshow',
});

export const secondSlideshowCamera = createSlideshowCamera({
  key: 'immich-slideshow-camera-2',
  platformDeviceId: 'immich-slideshow-2',
  profileNumber: 2,
  name: 'Immich slideshow 2',
});
