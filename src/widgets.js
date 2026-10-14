// -----------------------------------------------------------------------------
// Dashboard widget `immich_photo` (SDK v0.14+, Gladys 5.1+).
//
// The camera box of the dashboard only shows the image. This widget shows the
// photo on display on one slideshow camera (chosen in the widget settings),
// with its caption, the state of the slideshow and two buttons: next photo and
// refresh the source. The core renders the declarative content; the image
// itself is served by `widgetImage` (onWidgetGetImage) from the last slides
// the camera kept.
//
// The content follows the slideshow: its TTL is the slide interval, and
// src/app.js nudges the widget at every new slide (rate-limited by the core to
// one pull per 10 s, the shortest slide interval).
// -----------------------------------------------------------------------------

import { createLogger, DEVICE_TRANSPORTS, WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { errorMessage, isNetworkError } from './devices/slideshowCamera.js';
import { findBlueprintByDevice } from './devices/index.js';
import { mapText, isEmptyText } from './i18n.js';
import { transportForUrl } from './transport.js';

const logger = createLogger({ name: 'widgets' });

// Widget key, as declared in the manifest `widgets` field.
export const PHOTO_WIDGET = 'immich_photo';

// Keys of the `button` actions the content declares.
export const PHOTO_WIDGET_ACTIONS = Object.freeze({ NEXT: 'next', REFRESH: 'refresh' });

const MIN_TTL_SECONDS = 10;
const MAX_TTL_SECONDS = 3_600;

function truncate(text, max) {
  return mapText(text, (value) => (value.length > max ? `${value.slice(0, max - 1)}…` : value));
}

function stateRow(blueprint, config, health) {
  const label = { en: 'Slideshow', fr: 'Diaporama', de: 'Diashow', es: 'Pase de fotos' };
  if (!blueprint.isReady(config)) {
    return {
      label,
      icon: 'settings',
      value: {
        en: 'Not configured',
        fr: 'Non configuré',
        de: 'Nicht eingerichtet',
        es: 'Sin configurar',
      },
      color: WIDGET_COLORS.WARNING,
    };
  }
  const error = health.get(blueprint.key);
  if (error) {
    return {
      label,
      icon: 'alert-triangle',
      value: isNetworkError(error)
        ? { en: 'Unreachable', fr: 'Injoignable', de: 'Nicht erreichbar', es: 'Inaccesible' }
        : { en: 'Error', fr: 'En erreur', de: 'Fehler', es: 'Error' },
      color: WIDGET_COLORS.DANGER,
    };
  }
  return {
    label,
    icon: 'play',
    value: { en: 'Running', fr: 'En cours', de: 'Läuft', es: 'En marcha' },
    color: WIDGET_COLORS.SUCCESS,
  };
}

function connectionRow(blueprint, config) {
  const local = transportForUrl(blueprint.profile(config).immich_url) === DEVICE_TRANSPORTS.LOCAL;
  return {
    label: {
      en: 'Immich server',
      fr: 'Serveur Immich',
      de: 'Immich-Server',
      es: 'Servidor Immich',
    },
    icon: local ? 'home' : 'cloud',
    value: local
      ? { en: 'Local', fr: 'Local', de: 'Lokal', es: 'Local' }
      : { en: 'Cloud', fr: 'Cloud', de: 'Cloud', es: 'Nube' },
    color: local ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.INFO,
  };
}

function sourceRows(blueprint) {
  const { sourceName, loadedImageCount, totalImageCount } = blueprint.getStatus();
  if (isEmptyText(sourceName)) {
    return [];
  }
  return [
    {
      label: { en: 'Source', fr: 'Source', de: 'Quelle', es: 'Origen' },
      icon: 'image',
      value: truncate(sourceName, 40),
      color: WIDGET_COLORS.NEUTRAL,
    },
    {
      label: { en: 'Photos', fr: 'Photos', de: 'Fotos', es: 'Fotos' },
      icon: 'layers',
      value:
        totalImageCount > loadedImageCount
          ? `${loadedImageCount} / ${totalImageCount}`
          : loadedImageCount,
      color: WIDGET_COLORS.NEUTRAL,
    },
  ];
}

/**
 * Build the widget content for one slideshow camera.
 * @param {object} gladys SDK client.
 * @param {{ settings: object, config: object, health: Map, blueprints: object[] }} context
 */
export function buildPhotoWidgetContent(gladys, { settings, config, health, blueprints }) {
  const blueprint = settings?.camera
    ? findBlueprintByDevice(gladys, { external_id: settings.camera }, blueprints)
    : null;
  if (!blueprint) {
    return {
      ttl_seconds: MAX_TTL_SECONDS,
      components: [
        {
          type: 'text',
          text: {
            en: 'Choose an Immich slideshow camera in the widget settings.',
            fr: 'Choisissez une caméra de diaporama Immich dans les réglages du widget.',
            de: 'Wählen Sie in den Widget-Einstellungen eine Immich-Diashow-Kamera.',
            es: 'Elija una cámara de pase de fotos de Immich en los ajustes del widget.',
          },
        },
      ],
    };
  }

  const profile = blueprint.profile(config);
  const slide = blueprint.currentSlide();
  const error = health.get(blueprint.key);
  const components = [];

  if (slide) {
    components.push({
      type: 'image',
      key: slide.imageKey,
      alt: slide.originalFileName || {
        en: 'Immich photo',
        fr: 'Photo Immich',
        de: 'Immich-Foto',
        es: 'Foto de Immich',
      },
      fit: 'contain',
    });
    // The camera image already carries the caption band when it is enabled.
    if (!isEmptyText(slide.caption) && !profile.show_caption) {
      components.push({ type: 'text', variant: 'caption', text: truncate(slide.caption, 80) });
    }
  } else if (blueprint.isReady(config) && !error) {
    components.push({
      type: 'text',
      text: {
        en: 'Waiting for the first photo…',
        fr: 'En attente de la première photo…',
        de: 'Warten auf das erste Foto…',
        es: 'Esperando la primera foto…',
      },
    });
  }

  if (error) {
    components.push({ type: 'text', text: errorMessage(error) });
  } else if (!blueprint.isReady(config)) {
    components.push({
      type: 'text',
      text: {
        en: 'Complete the Immich settings of this slideshow in the integration configuration.',
        fr: 'Complétez les réglages Immich de ce diaporama dans la configuration de l’intégration.',
        de: 'Vervollständigen Sie die Immich-Einstellungen dieser Diashow in der Konfiguration der Integration.',
        es: 'Complete los ajustes de Immich de este pase en la configuración de la integración.',
      },
    });
  }

  components.push({
    type: 'status',
    items: [
      stateRow(blueprint, config, health),
      ...(blueprint.isReady(config) ? [connectionRow(blueprint, config)] : []),
      ...sourceRows(blueprint),
    ],
  });

  if (blueprint.isReady(config)) {
    components.push(
      {
        type: 'button',
        label: {
          en: 'Next photo',
          fr: 'Photo suivante',
          de: 'Nächstes Foto',
          es: 'Foto siguiente',
        },
        icon: 'skip-forward',
        style: 'primary',
        action: { key: PHOTO_WIDGET_ACTIONS.NEXT },
      },
      {
        type: 'button',
        label: { en: 'Refresh', fr: 'Actualiser', de: 'Aktualisieren', es: 'Actualizar' },
        icon: 'refresh-cw',
        style: 'secondary',
        action: { key: PHOTO_WIDGET_ACTIONS.REFRESH },
      },
    );
  }

  return {
    ttl_seconds: Math.min(MAX_TTL_SECONDS, Math.max(MIN_TTL_SECONDS, profile.slide_interval)),
    components,
  };
}

export const WIDGETS = {
  [PHOTO_WIDGET]: {
    async get(gladys, context) {
      logger.debug(`onWidgetGet <- ${PHOTO_WIDGET} (${context.settings?.camera ?? 'no camera'})`);
      return buildPhotoWidgetContent(gladys, context);
    },

    /**
     * A tapped button. `run(blueprint, fn)` (src/app.js) reports the outcome
     * to the connection status and the transport badge. After a successful
     * action the core refetches the content by itself: no nudge needed.
     */
    async action(gladys, { actionKey, settings, config, blueprints, run }) {
      logger.info(`onWidgetAction <- ${PHOTO_WIDGET}.${actionKey}`);
      const blueprint = findBlueprintByDevice(
        gladys,
        { external_id: settings?.camera },
        blueprints,
      );
      if (!blueprint) {
        throw new Error('Choose an Immich slideshow camera in the widget settings.');
      }
      if (actionKey === PHOTO_WIDGET_ACTIONS.NEXT) {
        const slide = await run(blueprint, () => blueprint.showNext(gladys, { config }));
        return {
          en: truncate(`Showing ${slide.originalFileName || 'the next photo'}`, 200),
          fr: truncate(`Affichage de ${slide.originalFileName || 'la photo suivante'}`, 200),
          de: truncate(`Angezeigt wird ${slide.originalFileName || 'das nächste Foto'}`, 200),
          es: truncate(`Mostrando ${slide.originalFileName || 'la foto siguiente'}`, 200),
        };
      }
      if (actionKey === PHOTO_WIDGET_ACTIONS.REFRESH) {
        return run(blueprint, () => blueprint.refreshNow(gladys, { config }));
      }
      // Throwing acks the action as failed: the message reaches the user.
      throw new Error(`Unknown widget action: ${actionKey}`);
    },
  },
};

/**
 * Raw base64 JPEG of a widget image key, from the slides the cameras kept.
 * The camera images stay under 110 KB and 1280 px: within the widget bounds.
 */
export function widgetImage(imageKey, blueprints) {
  for (const blueprint of blueprints) {
    const image = blueprint.widgetImage(imageKey);
    if (image) {
      return image;
    }
  }
  throw new Error(`Unknown or expired widget image: ${imageKey}`);
}

/** Ask the core to re-pull the widgets now (fire-and-forget, rate-limited). */
export function refreshWidgets(gladys) {
  for (const key of Object.keys(WIDGETS)) {
    try {
      gladys.requestWidgetRefresh(key);
    } catch (error) {
      logger.debug(`Widget refresh nudge dropped: ${error.message}`);
    }
  }
}
