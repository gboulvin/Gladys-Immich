// -----------------------------------------------------------------------------
// Gladys external integration entry point for the Immich slideshow.
//
// The SDK owns authentication, WebSocket reconnection and acknowledgements. The
// integration itself owns only its configuration, Immich calls and one virtual
// camera device whose image changes on the configured slideshow interval.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { normalizeConfig, validateConfig } from './src/config.js';
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

async function setImmichConnectionStatus() {
  const problem = validateConfig(config);
  if (problem) {
    await gladys.setConnectionStatus(false, problem);
    return;
  }

  try {
    await DEVICE_BLUEPRINTS[0].testConnection(gladys, { config });
    await gladys.setConnectionStatus(true);
  } catch (error) {
    logger.error('Immich connection check failed', error);
    await gladys.setConnectionStatus(false, DEVICE_BLUEPRINTS[0].errorMessage(error));
  }
}

// Gladys asks for the virtual camera in the Discovery tab.
gladys.onScanRequest(async () => {
  logger.info('Publishing the Immich slideshow camera for discovery');
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

// Actions rendered in the Gladys Configuration tab.
gladys.onAction('test_connection', () => DEVICE_BLUEPRINTS[0].testConnection(gladys, { config }));
gladys.onAction('list_albums', () => DEVICE_BLUEPRINTS[0].listAlbums(gladys, { config }));
gladys.onAction('refresh_now', () => DEVICE_BLUEPRINTS[0].refreshNow(gladys, { config }));

// A change of source, key, or timing restarts the loop using the new settings.
gladys.onConfigUpdated(async (newConfig) => {
  logger.info('Immich configuration updated');
  config = normalizeConfig(newConfig);
  stopPushSubscriptions();
  DEVICE_BLUEPRINTS[0].reset();
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
  logger.info(`Received ${signal}; stopping the Immich slideshow`);
  stopPushSubscriptions();
});

logger.info('Starting Immich slideshow integration');
gladys.connect().catch((error) => {
  logger.error('Initial Gladys connection failed', error);
  process.exit(1);
});
