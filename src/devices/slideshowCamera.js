// -----------------------------------------------------------------------------
// Virtual Gladys cameras backed by independent Immich slideshows.
// -----------------------------------------------------------------------------

import {
  createLogger,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
} from '@gladysassistant/integration-sdk';
import {
  getSlideshowConfig,
  hasSlideshowConfiguration,
  validateConfig,
  validateConnectionConfig,
} from '../config.js';
import { EmptyPhotoSourceError, ImmichSlideshow } from '../slideshow.js';

const DEVICE_TYPE = 'camera';
const FEATURE = { IMAGE: 'image' };
const logger = createLogger({ name: 'immich-slideshow' });

function errorMessage(error) {
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
  if (error?.code === 'UNREACHABLE' || error?.code === 'TIMEOUT') {
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
 */
export function createSlideshowCamera({
  key,
  platformDeviceId,
  profileNumber,
  name,
  slideshow = new ImmichSlideshow(),
}) {
  const label = profileNumber === 1 ? 'Immich slideshow' : `Immich slideshow ${profileNumber}`;

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
    return slide;
  }

  return {
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
      return slide.image;
    },

    /** Start the dashboard feed and return its mandatory cleanup callback. */
    startPush(gladys, config) {
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
          await publishNextSlide(gladys, config);
        } catch (error) {
          logger.error(`Failed to publish the next Immich slide on ${label}`, error);
          await gladys
            .setConnectionStatus(false, error.localizedMessage ?? errorMessage(error))
            .catch(() => {});
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

    getStatus() {
      return slideshow.getStatus();
    },

    errorMessage,
  };
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
