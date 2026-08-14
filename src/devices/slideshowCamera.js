// -----------------------------------------------------------------------------
// Virtual Gladys camera backed by an Immich slideshow.
//
// Gladys 4.85 exposes an image channel for dashboard camera devices. Publishing
// a new preview to that channel on a controlled interval gives users a working
// slideshow today, while `src/photoProvider.js` remains reusable by the future
// native Photo-widget provider API announced by Gladys.
// -----------------------------------------------------------------------------

import {
  createLogger,
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES,
} from '@gladysassistant/integration-sdk';
import { validateConfig, validateConnectionConfig } from '../config.js';
import { EmptyPhotoSourceError, ImmichSlideshow } from '../slideshow.js';

const DEVICE_TYPE = 'camera';
const PLATFORM_DEVICE_ID = 'immich-slideshow';
const FEATURE = { IMAGE: 'image' };
const logger = createLogger({ name: 'immich-slideshow' });

const slideshow = new ImmichSlideshow();

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

function assertConfigured(config) {
  throwConfigProblem(validateConfig(config));
}

function assertConnectionConfigured(config) {
  throwConfigProblem(validateConnectionConfig(config));
}

async function publishNextSlide(gladys, config) {
  assertConfigured(config);
  const slide = await slideshow.next(config);
  const ids = gladys.externalIds(DEVICE_TYPE, PLATFORM_DEVICE_ID);
  await gladys.publishCameraImage(ids.device, slide.image);
  logger.info(`Published “${slide.originalFileName || slide.id}” from ${slide.sourceName}`);
  return slide;
}

export const slideshowCamera = {
  key: 'immich-slideshow-camera',

  deviceExternalId(gladys) {
    return gladys.externalIds(DEVICE_TYPE, PLATFORM_DEVICE_ID).device;
  },

  buildDevice(gladys) {
    const ids = gladys.externalIds(DEVICE_TYPE, PLATFORM_DEVICE_ID);
    return {
      name: 'Immich slideshow',
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
    assertConfigured(config);
    const slide = await slideshow.next(config);
    logger.info(`On-demand slide “${slide.originalFileName || slide.id}” from ${slide.sourceName}`);
    return slide.image;
  },

  /** Start the dashboard feed and return its mandatory cleanup callback. */
  startPush(gladys, config) {
    if (validateConfig(config)) {
      logger.info('Slideshow waiting for a complete Immich configuration.');
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
        logger.error('Failed to publish the next Immich slide', error);
        await gladys
          .setConnectionStatus(false, error.localizedMessage ?? errorMessage(error))
          .catch(() => {});
      }
    };

    // Publish immediately; users do not wait for the first interval to elapse.
    void publish();
    const interval = setInterval(() => void publish(), config.slide_interval * 1_000);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  },

  reset() {
    slideshow.reset();
  },

  async testConnection(_gladys, { config }) {
    assertConfigured(config);
    const { albumCount } = await slideshow.testConnection(config);
    return {
      en: `Immich connection successful. ${albumCount} album${albumCount === 1 ? '' : 's'} found.`,
      fr: `Connexion Immich réussie. ${albumCount} album${albumCount === 1 ? '' : 's'} trouvé${albumCount === 1 ? '' : 's'}.`,
    };
  },

  async listAlbums(_gladys, { config }) {
    assertConnectionConfigured(config);
    const albums = await slideshow.listAlbums(config);
    const displayedAlbums = albums.slice(0, 50);
    const lines = displayedAlbums.map(
      (album) => `• ${album.name} — ${album.id}${album.assetCount ? ` (${album.assetCount})` : ''}`,
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
    assertConfigured(config);
    await slideshow.refresh(config, { force: true });
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
