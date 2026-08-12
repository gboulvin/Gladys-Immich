// Registry of the virtual device exposed by this integration.

import { slideshowCamera } from './slideshowCamera.js';

export const DEVICE_BLUEPRINTS = [slideshowCamera];

/** Build the discovery payload advertised in the Gladys Discovery tab. */
export function buildDiscoveredDevices(gladys, config) {
  return DEVICE_BLUEPRINTS.map((blueprint) => blueprint.buildDevice(gladys, config));
}

/** Route a Gladys camera-image request to the virtual Immich camera. */
export function findBlueprintByDevice(gladys, device) {
  return DEVICE_BLUEPRINTS.find(
    (blueprint) => blueprint.deviceExternalId(gladys) === device.external_id,
  );
}
