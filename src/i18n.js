// -----------------------------------------------------------------------------
// Languages of the integration.
//
// Every user-facing text is a multi-language object with one entry per
// language below (`en` is the fallback Gladys shows for any other language).
// Texts built from Immich data (caption dates, source names) are built for
// each language at once, so the dashboard picks the viewer's own.
// -----------------------------------------------------------------------------

export const LANGUAGES = Object.freeze(['en', 'fr', 'de', 'es']);

export const DEFAULT_CAPTION_LANGUAGE = 'fr';

const LOCALES = Object.freeze({ en: 'en-GB', fr: 'fr-FR', de: 'de-DE', es: 'es-ES' });

/** Intl locale of a language, e.g. `de` → `de-DE`. */
export function localeOf(language) {
  return LOCALES[language] ?? LOCALES.en;
}

/** True for one of the supported language codes. */
export function isLanguage(value) {
  return LANGUAGES.includes(value);
}

/** Build a multi-language object from `build(language)`. */
export function perLanguage(build) {
  return Object.fromEntries(LANGUAGES.map((language) => [language, build(language)]));
}

/** The text of one language: a plain string as is, else that entry or `en`. */
export function inLanguage(text, language) {
  if (text === null || text === undefined) {
    return '';
  }
  if (typeof text !== 'object') {
    return String(text);
  }
  return text[language] ?? text.en ?? '';
}

/** Apply `transform` to a plain string, or to every entry of a multi-language object. */
export function mapText(text, transform) {
  if (text === null || typeof text !== 'object') {
    return transform(String(text ?? ''));
  }
  return Object.fromEntries(
    Object.entries(text).map(([language, value]) => [language, transform(value)]),
  );
}

/** True when the text is empty in every language. */
export function isEmptyText(text) {
  if (text === null || typeof text !== 'object') {
    return !text;
  }
  return Object.values(text).every((value) => !value);
}
