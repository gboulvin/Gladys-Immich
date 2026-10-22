# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [0.3.1] - 2026-10-22

### Security

- `brace-expansion`, pulled in by ESLint, raised to 5.0.12 against the
  high-severity denial-of-service advisories (GHSA-mh99-v99m-4gvg and
  related). A development tool only: the published image never shipped it.
- The image is rebuilt on the latest `node:24-alpine` (Node.js and Alpine
  security patches); development tools and CI actions up to date.

## [0.3.0] - 2026-10-14

### Added

- German and Spanish, next to English and French: settings, action messages,
  connection and badge messages, the dashboard widget, the scene action, and
  the user documentation (`docs/de.md`, `docs/es.md`).
- **Caption language** setting for each slideshow (English, French, German or
  Spanish, French by default): the language of the date burned into the image
  and of the source name the scene action returns.

### Changed

- The dashboard widget shows the caption date and the source name (“Memories —
  on this day”, “Albums — …”) in the language of each viewer.

## [0.2.0] - 2026-10-12

### Added

- **Immich photo** dashboard widget: the photo on display on a slideshow
  camera, its caption, the slideshow state, how Immich is reached, the source
  and the number of photos, with **Next photo** and **Refresh** buttons. It
  follows the camera at every new photo and shows the reason when the
  slideshow fails.
- **Show the next Immich photo** scene action: moves a slideshow camera on,
  optionally re-reading the source first, and returns `displayed`, `file_name`
  and `source_name` for the following actions (for example the built-in
  “Send camera image”).
- Each slideshow camera shows a transport badge in Gladys: `local` when the
  Immich URL points to the home network, `cloud` otherwise, `unreachable` when
  Immich does not answer, with an orange dot and the reason when Immich answers
  but the slideshow cannot run (API key refused, empty album, missing album).
- The connection status turns green again on its own once a failing slideshow
  recovers, and a successful **Test** or **Refresh** button clears a stale error.
- `CHANGELOG.md`, rolled by the Release workflow, and a GitHub Release for every
  version, with its changelog section as notes.
- CI runs the tests on Node 22 and 24, and builds the Docker image.
- Dependabot keeps the npm dependencies and the GitHub Actions up to date.
- `SECURITY.md` (how to report a vulnerability) and `CLAUDE.md` (project rules
  for contributors and coding assistants).
- Manifest tests: every action has a handler, `version` matches `package.json`,
  `docker_image` is tagged with it, descriptions hold 10 to 100 characters,
  placeholders are multi-language objects.

### Changed

- **Gladys 5.1.0 or later is required**, for the dashboard widget and the
  scene action.
- Integration SDK 0.15.0. The tests now run against the fake Gladys of the SDK,
  which refuses the payloads Gladys refuses.
- Node.js 22 or later is required (Node 20 is end-of-life).
- Sharp 0.35.5 for image resizing and captions.
- The README is now written in English and describes the two slideshows, the
  widget, the scene action and the release process.
- GitHub Actions: `actions/setup-node` v7 and `docker/setup-qemu-action` v4.

### Fixed

- The release commit no longer fails `npm run format:check`: the Release
  workflow updates the manifest `version` and `docker_image` in place instead of
  re-printing the whole file with `jq`.
- Captions no longer log a Fontconfig error (“No writable cache directories”)
  at every slide: the font cache of Sharp now lives on the `/data` volume, the
  container rootfs being read-only.
- The integration can write to `/data`: the image creates the directory owned by
  the `node` user, a new Docker volume was owned by root.

[Unreleased]: https://github.com/gboulvin/Gladys-Immich/compare/v0.3.1...HEAD
[0.3.1]: https://github.com/gboulvin/Gladys-Immich/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/gboulvin/Gladys-Immich/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/gboulvin/Gladys-Immich/releases/tag/v0.2.0
