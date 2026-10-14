// -----------------------------------------------------------------------------
// Scene actions (SDK v0.14+, Gladys 5.1+).
//
// `show_next_photo` puts the next photo on a slideshow camera right now, for
// example every morning, or when someone comes home. The outputs let the
// following actions of the scene gate on the result ({{displayed}}) or quote
// the photo; the core's "send camera image" action can then send that very
// photo in a message, since it is on the camera.
//
// Doctrine: `fields` arrive resolved (the camera is a device external_id), a
// scene action is never a condition, so a slideshow that cannot show a photo
// returns `displayed: false` instead of failing the scene action. Only the
// keys declared in the manifest `outputs` are kept by the core.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { findBlueprintByDevice } from './devices/index.js';
import { inLanguage } from './i18n.js';

const logger = createLogger({ name: 'scenes' });

const NOT_DISPLAYED = Object.freeze({ displayed: false, file_name: '', source_name: '' });

export const SCENE_ACTIONS = {
  /**
   * @param {object} gladys SDK client.
   * @param {{ fields: { camera: string, refresh?: boolean }, config: object,
   *   blueprints: object[], run: Function }} context `run(blueprint, fn)`
   *   reports the outcome to the connection status (src/app.js).
   */
  async show_next_photo(gladys, { fields, config, blueprints, run }) {
    logger.info(`Scene action show_next_photo <- ${fields.camera}`);
    const blueprint = findBlueprintByDevice(gladys, { external_id: fields.camera }, blueprints);
    if (!blueprint || !blueprint.isReady(config)) {
      logger.warn(`show_next_photo: ${fields.camera} is not a configured Immich slideshow`);
      return { ...NOT_DISPLAYED };
    }
    try {
      const slide = await run(blueprint, async () => {
        if (fields.refresh === true) {
          await blueprint.refreshNow(gladys, { config });
          return blueprint.currentSlide();
        }
        return blueprint.showNext(gladys, { config });
      });
      return {
        displayed: true,
        file_name: slide.originalFileName ?? '',
        // A scene output is one string: the language of the slideshow settings.
        source_name: inLanguage(slide.sourceName, blueprint.profile(config).caption_language),
      };
    } catch (error) {
      logger.error('show_next_photo failed', error);
      return { ...NOT_DISPLAYED };
    }
  },
};
