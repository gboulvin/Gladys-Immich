// -----------------------------------------------------------------------------
// Gladys external integration entry point for the Immich slideshow.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import {
  getSlideshowConfig,
  hasSlideshowConfiguration,
  normalizeConfig,
  validateConfig,
} from './src/config.js';
import {
  DEVICE_BLUEPRINTS,
  buildDiscoveredDevices,
  findBlueprintByDevice,
} from './src/devices/index.js';

const gladys = new GladysIntegration();
let config = normalizeConfig();
let pushCleanups = [];

function stopPushSubscriptions() {
  for (const cleanup of pushCleanups) {
    try {
      cleanup?.();
    } catch (error) {
      logger.error('Slideshow cleanup failed', error);
    }
  }
  pushCleanups = [];
}

async function startPushSubscriptions() {
  stopPushSubscriptions();
  pushCleanups = DEVICE_BLUEPRINTS.filter(
    (blueprint) => typeof blueprint.startPush === 'function',
  ).map((blueprint) => blueprint.startPush(gladys, config));
}

async function publishDiscovery() {
  await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config));
}

function configuredBlueprints() {
  return DEVICE_BLUEPRINTS.filter((blueprint) =>
    hasSlideshowConfiguration(getSlideshowConfig(config, blueprint.profileNumber)),
  );
}

async function setImmichConnectionStatus() {
  const configured = configuredBlueprints();
  if (configured.length === 0) {
    await gladys.setConnectionStatus(false, {
      en: 'Configure at least one Immich slideshow.',
      fr: 'Configurez au moins un diaporama Immich.',
    });
    return;
  }

  for (const blueprint of configured) {
    const profile = getSlideshowConfig(config, blueprint.profileNumber);
    const problem = validateConfig(profile);
    if (problem) {
      await gladys.setConnectionStatus(false, problem);
      return;
    }
  }

  try {
    await Promise.all(configured.map((blueprint) => blueprint.testConnection(gladys, { config })));
    await gladys.setConnectionStatus(true);
  } catch (error) {
    logger.error('Immich connection check failed', error);
    await gladys.setConnectionStatus(false, configured[0].errorMessage(error));
  }
}

// Gladys asks for the virtual cameras in the Discovery tab.
gladys.onScanRequest(async () => {
  logger.info('Publishing Immich slideshow cameras for discovery');
  await publishDiscovery();
});

// Gladys requests a fresh dashboard camera image or a chat image.
gladys.onGetImage(async (device) => {
  const blueprint = findBlueprintByDevice(gladys, device);
  if (!blueprint?.onGetImage) {
    throw new Error(`No camera-image handler for ${device.external_id}`);
  }
  return blueprint.onGetImage(gladys, { device, config });
});

// Actions rendered in the Gladys Configuration tab. Keep the historical keys
// for the first slideshow, and expose an equivalent set for the second one.
gladys.onAction('test_connection', () => DEVICE_BLUEPRINTS[0].testConnection(gladys, { config }));
gladys.onAction('list_albums', () => DEVICE_BLUEPRINTS[0].listAlbums(gladys, { config }));
gladys.onAction('refresh_now', () => DEVICE_BLUEPRINTS[0].refreshNow(gladys, { config }));
gladys.onAction('test_connection_2', () => DEVICE_BLUEPRINTS[1].testConnection(gladys, { config }));
gladys.onAction('list_albums_2', () => DEVICE_BLUEPRINTS[1].listAlbums(gladys, { config }));
gladys.onAction('refresh_now_2', () => DEVICE_BLUEPRINTS[1].refreshNow(gladys, { config }));

// A change of either source, key, or timing restarts both independent loops.
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('Immich configuration updated');
  config = normalizeConfig(newConfig);
  stopPushSubscriptions();
  DEVICE_BLUEPRINTS.forEach((blueprint) => blueprint.reset());
  await publishDiscovery();
  await startPushSubscriptions();
  await setImmichConnectionStatus();
});

gladys.on('connected', async () => {
  try {
    config = normalizeConfig(await gladys.getConfig());
    await publishDiscovery();
    await startPushSubscriptions();
    await setImmichConnectionStatus();
  } catch (error) {
    logger.error('Immich slideshow initialization failed', error);
    await gladys
      .setConnectionStatus(false, {
        en: 'Immich slideshow initialization failed. Check the integration logs.',
        fr: 'L’initialisation du diaporama Immich a échoué. Consultez les journaux de l’intégration.',
      })
      .catch(() => {});
  }
});

gladys.on('disconnected', () => {
  stopPushSubscriptions();
});

gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal}; stopping Immich slideshows`);
  stopPushSubscriptions();
});

logger.info('Starting Immich slideshow integration');
gladys.connect().catch((error) => {
  logger.error('Initial Gladys connection failed', error);
  process.exit(1);
});
