// Registry of the virtual cameras exposed by this integration.

import { secondSlideshowCamera, slideshowCamera } from './slideshowCamera.js';

export const DEVICE_BLUEPRINTS = [slideshowCamera, secondSlideshowCamera];

/** Build the discovery payload advertised in the Gladys Discovery tab. */
export function buildDiscoveredDevices(gladys, config) {
  return DEVICE_BLUEPRINTS.map((blueprint) => blueprint.buildDevice(gladys, config));
}

/** Route a Gladys camera-image request to the matching virtual Immich camera. */
export function findBlueprintByDevice(gladys, device) {
  return DEVICE_BLUEPRINTS.find(
    (blueprint) => blueprint.deviceExternalId(gladys) === device.external_id,
  );
}
