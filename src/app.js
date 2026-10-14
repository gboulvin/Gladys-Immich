// -----------------------------------------------------------------------------
// SDK wiring of the Immich slideshow integration.
//
// Kept out of index.js so the tests can drive it end-to-end with the fake
// Gladys of the SDK (`@gladysassistant/integration-sdk/testing`): index.js only
// creates the real client, registers these handlers and connects.
//
// Besides the camera images, the integration reports two things Gladys shows
// in its UI, both derived from the last outcome of every camera (`health`):
//   - the connection status of the Configuration screen (one for the whole
//     integration: red as soon as one configured slideshow fails);
//   - the transport badge of each camera (local / cloud / unreachable, plus a
//     degraded dot when Immich answers but the slideshow cannot run).
//
// The same cameras are reachable from four surfaces: the Configuration buttons
// (manifest `actions`), a scene (`scene_actions`, src/scenes.js), the
// dashboard widget (`widgets`, src/widgets.js) and the slideshow loop. All of
// them report their outcome through `run()`.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  getSlideshowConfig,
  hasSlideshowConfiguration,
  normalizeConfig,
  validateConfig,
} from './config.js';
import {
  DEVICE_BLUEPRINTS,
  buildDiscoveredDevices,
  buildTransportEntries,
  findBlueprintByDevice,
} from './devices/index.js';
import { errorMessage } from './devices/slideshowCamera.js';
import { SCENE_ACTIONS } from './scenes.js';
import { WIDGETS, refreshWidgets, widgetImage } from './widgets.js';

const logger = createLogger({ name: 'immich-app' });

const NOT_CONFIGURED = Object.freeze({
  en: 'Configure at least one Immich slideshow.',
  fr: 'Configurez au moins un diaporama Immich.',
  de: 'Richten Sie mindestens eine Immich-Diashow ein.',
  es: 'Configure al menos un pase de fotos de Immich.',
});

const INIT_FAILED = Object.freeze({
  en: 'Immich slideshow initialization failed. Check the integration logs.',
  fr: 'L’initialisation du diaporama Immich a échoué. Consultez les journaux de l’intégration.',
  de: 'Die Initialisierung der Immich-Diashow ist fehlgeschlagen. Prüfen Sie die Protokolle der Integration.',
  es: 'Falló la inicialización del pase de fotos de Immich. Consulte los registros de la integración.',
});

// Two outcomes are "the same" when the user would read the same message: a
// slideshow failing every minute for the same reason is reported once.
function healthSignature(error) {
  if (error === undefined) {
    return 'unknown';
  }
  return error === null ? 'ok' : `error:${errorMessage(error).en}`;
}

/**
 * Register every handler of the integration on a Gladys client.
 * @param {import('@gladysassistant/integration-sdk').GladysIntegration} gladys
 * @param {{ blueprints?: Array<object> }} [options] Cameras to serve (tests
 *   inject cameras backed by a fake slideshow).
 * @returns {{ stop: () => void }} Stops the slideshow loops (shutdown).
 */
export function registerHandlers(gladys, { blueprints = DEVICE_BLUEPRINTS } = {}) {
  let config = normalizeConfig();
  let pushCleanups = [];
  // Last Immich outcome per camera key: null = worked, Error = failed.
  const health = new Map();

  const profileOf = (blueprint) => getSlideshowConfig(config, blueprint.profileNumber);
  const isConfigured = (blueprint) => hasSlideshowConfiguration(profileOf(blueprint));
  const isReady = (blueprint) => !validateConfig(profileOf(blueprint));

  function connectionStatus() {
    const configured = blueprints.filter(isConfigured);
    if (configured.length === 0) {
      return { connected: false, message: NOT_CONFIGURED };
    }
    for (const blueprint of configured) {
      const problem = validateConfig(profileOf(blueprint));
      if (problem) {
        return { connected: false, message: problem };
      }
    }
    for (const blueprint of configured) {
      const error = health.get(blueprint.key);
      if (error) {
        return { connected: false, message: errorMessage(error) };
      }
    }
    return { connected: true };
  }

  async function publishHealth() {
    const status = connectionStatus();
    await gladys.setConnectionStatus(status.connected, status.message);
    const entries = buildTransportEntries(gladys, config, health, blueprints);
    if (entries.length > 0) {
      await gladys.publishTransports(entries);
    }
  }

  async function reportHealth(blueprint, error) {
    if (healthSignature(health.get(blueprint.key)) === healthSignature(error)) {
      health.set(blueprint.key, error);
      return;
    }
    health.set(blueprint.key, error);
    try {
      await publishHealth();
    } catch (publishError) {
      logger.error('Failed to report the Immich slideshow health', publishError);
    }
  }

  /**
   * Run an operation on one camera and report its outcome: a success clears a
   * stale error, a failure shows in the status and the badge. Rethrows.
   */
  async function run(blueprint, operation) {
    try {
      const result = await operation();
      if (isReady(blueprint)) {
        await reportHealth(blueprint, null);
      }
      return result;
    } catch (error) {
      if (isReady(blueprint)) {
        await reportHealth(blueprint, error);
      }
      throw error;
    }
  }

  // Ask every ready slideshow whether Immich answers, then report the result.
  async function checkConnections() {
    const ready = blueprints.filter(isReady);
    const outcomes = await Promise.allSettled(
      ready.map((blueprint) => blueprint.testConnection(gladys, { config })),
    );
    outcomes.forEach((outcome, index) => {
      const { key } = ready[index];
      const error = outcome.status === 'rejected' ? outcome.reason : null;
      if (error) {
        logger.error(`Immich connection check failed for ${key}`, error);
        health.set(key, error);
      } else if (!health.get(key)) {
        // The test only lists the albums: it must not erase an error the
        // slideshow loop met meanwhile (empty album, preview refused...).
        health.set(key, null);
      }
    });
    await publishHealth();
  }

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

  function startPushSubscriptions() {
    stopPushSubscriptions();
    pushCleanups = blueprints
      .filter((blueprint) => typeof blueprint.startPush === 'function')
      .map((blueprint) =>
        blueprint.startPush(gladys, config, {
          onHealth: (error) => reportHealth(blueprint, error),
          // A new photo on a camera: the widget showing it should follow.
          onSlide: () => refreshWidgets(gladys),
        }),
      );
  }

  async function publishDiscovery() {
    await gladys.publishDiscoveredDevices(buildDiscoveredDevices(gladys, config, blueprints));
  }

  async function initialize() {
    // Stop the running loops before their slideshow state is reset.
    stopPushSubscriptions();
    health.clear();
    blueprints.forEach((blueprint) => blueprint.reset?.());
    await publishDiscovery();
    startPushSubscriptions();
    await checkConnections();
    // The widget content follows the config and the health just computed,
    // and the nudges sent while disconnected were dropped.
    refreshWidgets(gladys);
  }

  // Gladys asks for the virtual cameras in the Discovery tab.
  gladys.onScanRequest(async () => {
    logger.info('Publishing Immich slideshow cameras for discovery');
    await publishDiscovery();
  });

  // Gladys requests a fresh dashboard camera image or a chat image.
  gladys.onGetImage(async (device) => {
    const blueprint = findBlueprintByDevice(gladys, device, blueprints);
    if (!blueprint?.onGetImage) {
      throw new Error(`No camera-image handler for ${device.external_id}`);
    }
    return blueprint.onGetImage(gladys, { device, config });
  });

  // Buttons of the Configuration screen, declared per camera. Their outcome
  // also refreshes the status: a successful test clears a stale error.
  for (const blueprint of blueprints) {
    for (const [actionKey, handler] of Object.entries(blueprint.actions ?? {})) {
      gladys.onAction(actionKey, (fields) =>
        run(blueprint, () => handler(gladys, { fields, config })),
      );
    }
  }

  // Scene actions (Gladys 5.1+): the RESOLVED fields, the declared outputs.
  for (const [actionKey, handler] of Object.entries(SCENE_ACTIONS)) {
    gladys.onSceneAction(actionKey, (fields) =>
      handler(gladys, { fields, config, blueprints, run }),
    );
  }

  // Dashboard widgets (Gladys 5.1+): content pulls, button taps, images.
  for (const [widgetKey, widget] of Object.entries(WIDGETS)) {
    gladys.onWidgetGet(widgetKey, (request) =>
      widget.get(gladys, { ...request, config, health, blueprints }),
    );
    gladys.onWidgetAction(widgetKey, (actionKey, params, { settings }) =>
      widget.action(gladys, { actionKey, params, settings, config, blueprints, run }),
    );
  }
  gladys.onWidgetGetImage(async (imageKey) => widgetImage(imageKey, blueprints));

  // A change of either source, key, or timing restarts both independent loops.
  gladys.onConfigUpdated(async (newConfig) => {
    logger.info('Immich configuration updated');
    config = normalizeConfig(newConfig);
    await initialize();
  });

  gladys.on('connected', async () => {
    try {
      config = normalizeConfig(await gladys.getConfig());
      await initialize();
    } catch (error) {
      logger.error('Immich slideshow initialization failed', error);
      await gladys.setConnectionStatus(false, INIT_FAILED).catch(() => {});
    }
  });

  gladys.on('disconnected', () => {
    stopPushSubscriptions();
  });

  return { stop: stopPushSubscriptions };
}
