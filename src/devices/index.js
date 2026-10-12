// -----------------------------------------------------------------------------
// Registry of the virtual cameras exposed by this integration.
//
// Each camera blueprint exposes:
//   - key, profileNumber          : identifiers (logs, config profile)
//   - deviceExternalId(gladys)    : the device external_id (for dispatch)
//   - buildDevice(gladys, config) : the discovery payload sent to Gladys
//   - onGetImage(gladys, {...})   : fresh slide for the dashboard / chat
//   - startPush(gladys, config, { onHealth }): slideshow loop, returns cleanup
//   - transport(config, lastError): badge entry, or null when not configured
//   - testConnection(gladys, {...}): reachability check used for the status
//   - actions                     : manifest action handlers, keyed by the
//     action `key` declared in gladys-assistant-integration.json
// -----------------------------------------------------------------------------

import { secondSlideshowCamera, slideshowCamera } from './slideshowCamera.js';

export const DEVICE_BLUEPRINTS = [slideshowCamera, secondSlideshowCamera];

/** Build the discovery payload advertised in the Gladys Discovery tab. */
export function buildDiscoveredDevices(gladys, config, blueprints = DEVICE_BLUEPRINTS) {
  return blueprints.map((blueprint) => blueprint.buildDevice(gladys, config));
}

/** Route a Gladys camera-image request to the matching virtual Immich camera. */
export function findBlueprintByDevice(gladys, device, blueprints = DEVICE_BLUEPRINTS) {
  return blueprints.find((blueprint) => blueprint.deviceExternalId(gladys) === device.external_id);
}

/**
 * Build the `publishTransports` payload: one entry per configured camera.
 * @param {Map<string, Error | null>} health Last Immich outcome per camera key.
 */
export function buildTransportEntries(gladys, config, health, blueprints = DEVICE_BLUEPRINTS) {
  return blueprints.flatMap((blueprint) => {
    const entry = blueprint.transport(config, health.get(blueprint.key));
    return entry ? [{ external_id: blueprint.deviceExternalId(gladys), ...entry }] : [];
  });
}
