# CLAUDE.md

Project rules for coding assistants (Claude Code reads this file) and for human
contributors.

## What this is

A Gladys Assistant **external integration** that turns Immich albums or
"on this day" memories into up to two virtual dashboard cameras. A Node.js
service (Node 22+, ESM, no build step) running in its own sandboxed Docker
container, talking to Gladys through
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).
It started from the official JavaScript template. Its runtime dependencies are
the SDK and `sharp` (image resizing and captions).

## Commands

```bash
npm install
npm test                                  # node --test, the built-in runner
node --test test/app.test.js              # one file
npm run lint                              # ESLint
npm run format:check                      # Prettier, as the CI runs it
npm run format                            # Prettier, fix in place
npm run check                             # the three CI gates in a row
npx github:GladysAssistant/integration-store .   # store admission checks
```

The CI (`.github/workflows/ci.yml`) runs `format:check`, `lint` and `test` on
Node 22 and 24, and builds the Docker image.

## Architecture

```
index.js                          creates the SDK client, registers src/app.js, connects
src/app.js                        SDK wiring: discovery, images, actions, status, transport badges
src/devices/index.js              registry of the cameras + dispatch helpers
src/devices/slideshowCamera.js    one virtual camera per slideshow profile (1 and 2)
src/widgets.js                    `immich_photo` dashboard widget (manifest `widgets`)
src/scenes.js                     `show_next_photo` scene action (manifest `scene_actions`)
src/config.js                     DEFAULT_CONFIG (mirrors the manifest defaults) + normalization
src/transport.js                  local / cloud badge derived from the Immich URL
src/immichClient.js               Immich REST client (x-api-key, timeouts, typed errors)
src/photoProvider.js              albums, memories, video filtering, dedup, captions
src/slideshow.js                  asset-list cache and slide rotation
src/imageTransformer.js           orientation, caption band, JPEG under the camera size limit
gladys-assistant-integration.json manifest: name, config_schema, actions, image...
src/i18n.js                       languages (en, fr, de, es), per-language text helpers
docs/{en,fr,de,es}.md             user documentation, re-hosted by Gladys (mandatory)
test/                             node --test, against the SDK's fake Gladys (integration-sdk/testing)
.github/scripts/release.mjs       release helpers (manifest bump, changelog), tested in test/
```

## Rules

- **External ids are forever.** `immich-slideshow` and `immich-slideshow-2`
  identify the two cameras users already created; the manifest keys of
  slideshow 1 have no suffix and those of slideshow 2 end in `_2`. Never rename
  a device id, config key or action key: it orphans dashboards and settings.
- **Camera channel limits.** At most 12 images/minute per camera and 150 KB
  per image: `slide_interval` stays ≥ 10 s and `imageTransformer.js` keeps the
  JPEG under the limit.
- **The container rootfs is read-only.** Write only under `/data`. Never log
  the Immich API keys.
- **Versions belong to the Release workflow** (Actions → Release). Never edit
  `version` in `package.json` or in the manifest, nor the `docker_image` tag,
  by hand. `test/manifest.test.js` checks they agree.
- **Changelog.** Every user-visible change adds a line under `## [Unreleased]`
  in `CHANGELOG.md` (`### Added`, `Changed`, `Fixed`, `Removed`, `Security`).
  Never write a version heading.
- **Manifest.** Texts are multi-language objects
  `{ "en": ..., "fr": ..., "de": ..., "es": ... }`.
  The catalog `description` holds 10 to 100 characters per language.
  `widgets` and `scene_actions` need `gladys_version >= 5.1.0`, and a widget
  description holds at most 100 characters. `test/manifest.test.js` ties the
  manifest to the code (defaults, action, scene and widget handlers): change
  both sides together. Scene action outputs and widget keys are forever too.
- **Widgets.** Check every content with `validateWidgetContent` (`[]` means
  rendered as sent) and every image with `validateWidgetImage`. A widget image
  is cached one hour by key: a different image needs a different key.
- **User-facing text** exists in English, French, German and Spanish
  (`LANGUAGES` in `src/i18n.js`): action messages, status messages, widget
  texts, manifest texts and `docs/{en,fr,de,es}.md`, in sync.
  `test/manifest.test.js` refuses a manifest text missing a language. Texts
  built from Immich data (caption dates, source names) are built for every
  language with `perLanguage`.
- **Style.** Prettier formats, ESLint catches mistakes. Comments explain why,
  in English. Tests never touch the network.
