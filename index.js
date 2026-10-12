// -----------------------------------------------------------------------------
// Gladys external integration entry point for the Immich slideshow.
//
// The SDK reads the GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN and
// GLADYS_INTEGRATION_SELECTOR variables injected by the Gladys supervisor. Every
// handler lives in src/app.js, registered here before connect().
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { registerHandlers } from './src/app.js';

const gladys = new GladysIntegration();
const app = registerHandlers(gladys);

gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal}; stopping Immich slideshows`);
  app.stop();
});

logger.info('Starting Immich slideshow integration');
gladys.connect().catch((error) => {
  logger.error('Initial Gladys connection failed', error);
  process.exit(1);
});
