# Immich Slideshow for Gladys

> **A Gladys external integration that shows one or more Immich albums, or the “on this day” memories, as a slideshow on a virtual dashboard camera.**

This project started from the [official Gladys JavaScript external-integration template][1]. It is a `device` integration that uses the camera image channel to run a slideshow on the Gladys **5.1+** dashboard. It also provides an **Immich photo dashboard widget** (current photo, caption, state, buttons) and a **scene action** (show the next photo), two capabilities of the integration SDK 0.15 [2] [3].

The integration is listed in the **multimedia** catalog category.

## Features

| Feature                | Behaviour                                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Immich sources**     | One or more albums by UUID, merged and deduplicated, or the `on_this_day` memories, through the `albums`, `search/metadata` and `memories` APIs. |
| **Two slideshows**     | Up to two virtual cameras, **Immich slideshow** and **Immich slideshow 2**, each with its own server, source, intervals and caption setting.     |
| **Dashboard**          | Each camera publishes its first photo on connection, then at its configured interval.                                                            |
| **Widget**             | **Immich photo**: the photo on display, caption, slideshow state, local/cloud access, source and photo count, **Next photo** and **Refresh**.    |
| **Scene action**       | **Show the next Immich photo**, with the `displayed`, `file_name` and `source_name` outputs for the following actions.                           |
| **Transport badge**    | `local`, `cloud` or `unreachable`, derived from the Immich URL, with the reason when Immich answers but the slideshow cannot run.                |
| **Images**             | `IMAGE` assets only; videos are deliberately skipped.                                                                                            |
| **Controlled quality** | Oriented Immich preview, optional caption band at the bottom, then resized and JPEG-compressed under the Gladys camera payload limit.            |
| **Performance**        | Asset list capped at 1–500 images and refreshed independently of the slide interval; only the preview of the photo on display is fetched.        |
| **Privacy**            | The API key is a Gladys `secret` field, never sent to the dashboard browser.                                                                     |
| **Control**            | Connection test, album list, immediate refresh, connection status that recovers on its own, localized errors.                                    |

## Architecture

```text
Immich API ── x-api-key ──► Immich client ──► photoProvider ──► slideshow
                                                                   │
Gladys SDK ◄── publishCameraImage / onGetImage ◄── virtual cameras (1 and 2)
     │                                                             │
     ├── onWidgetGetImage / requestWidgetRefresh ◄── widget ◄──────┤
     └── scene action (show_next_photo) ───────────────────────────┘
                                                                   │
                                                          Gladys dashboard
```

Keeping the HTTP client, the source resolution and the slideshow engine apart keeps the code testable and the Immich logic independent of the Gladys SDK. The current Immich API documents the `GET /albums`, `GET /albums/{id}`, `GET /memories` and `GET /assets/{id}/thumbnail` endpoints and their permissions [4] [5] [6] [7].

| Path                                                                 | Responsibility                                                                |
| -------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`index.js`](./index.js)                                             | Creates the SDK client, registers the app, connects and shuts down cleanly.   |
| [`src/app.js`](./src/app.js)                                         | SDK wiring: discovery, images, actions, configuration, status and badges.     |
| [`src/config.js`](./src/config.js)                                   | Defaults, limits and localized validation messages.                           |
| [`src/immichClient.js`](./src/immichClient.js)                       | Authenticated HTTP requests, timeouts and explicit Immich errors.             |
| [`src/photoProvider.js`](./src/photoProvider.js)                     | Albums, memories, video filtering, deduplication, order and caption metadata. |
| [`src/slideshow.js`](./src/slideshow.js)                             | List cache, forced refresh and slide rotation.                                |
| [`src/imageTransformer.js`](./src/imageTransformer.js)               | Orientation, caption, compression and size limit of the camera image.         |
| [`src/transport.js`](./src/transport.js)                             | Local / cloud badge derived from the Immich URL.                              |
| [`src/devices/index.js`](./src/devices/index.js)                     | Registry of the cameras and dispatch helpers.                                 |
| [`src/devices/slideshowCamera.js`](./src/devices/slideshowCamera.js) | One Gladys virtual camera per slideshow profile.                              |
| [`src/widgets.js`](./src/widgets.js)                                 | `immich_photo` dashboard widget.                                              |
| [`src/scenes.js`](./src/scenes.js)                                   | `show_next_photo` scene action.                                               |

## User setup

In Immich, create an API key with the `album.read`, `asset.read`, `asset.view` and `memory.read` permissions. In Gladys, open the integration and enter your server URL, for example `http://192.168.1.20:2283`, and the API key. For albums, use **List Immich albums**: it returns each album name, UUID and asset count; enter the chosen UUIDs in the form, separated by commas or line breaks. Enable **Show Immich caption** to burn the available description, location and capture date into a band at the bottom of the image. Avoid `localhost`: it points to the integration’s isolated container, not to your Immich server.

Once saved, run **Test Immich connection**, create the **Immich slideshow** device in the **Discovery** tab, then add that camera to a dashboard. Fill in the **Slideshow 2** fields to create a second, fully independent camera. See the full user documentation: [English](./docs/en.md) and [français](./docs/fr.md).

> The memories source changes every day. Keep a reasonable source refresh interval — one hour by default — and use **Refresh slideshow now** to apply a change immediately.

## Widget and scene action

| Capability       | Manifest key      | Code                                 | Role                                                                            |
| ---------------- | ----------------- | ------------------------------------ | ------------------------------------------------------------------------------- |
| Dashboard widget | `immich_photo`    | [`src/widgets.js`](./src/widgets.js) | Current photo of a camera (16:9 focus), caption, state, next / refresh buttons. |
| Scene action     | `show_next_photo` | [`src/scenes.js`](./src/scenes.js)   | Shows the next photo; outputs `displayed`, `file_name`, `source_name`.          |

Both pick the camera through a dynamic `"source": "devices"` selector. The widget serves its own images through `onWidgetGetImage`, from the last three slides each camera keeps; the image key changes with the photo and the caption option, since the core caches an image for an hour per key. The content TTL is the slide interval, and every new slide calls `requestWidgetRefresh`. These fields require `gladys_version >= 5.1.0`, which `test/manifest.test.js` checks.

## Local development

The project needs Node.js 22 or later; the production image runs on Node 24 Alpine. Install the dependencies, then run every check:

```bash
npm ci
npm run check
```

To run the integration against a Gladys instance in developer mode, provide the three variables the supervisor injects in production:

```bash
GLADYS_HOST_API_URL="http://localhost:1443" \
GLADYS_INTEGRATION_TOKEN="<developer token>" \
GLADYS_INTEGRATION_SELECTOR="immich-slideshow" \
LOG_LEVEL=debug \
npm start
```

The unit tests cover configuration validation, the HTTP client and its errors, asset selection and deduplication, the slideshow cache, the empty state, the transport badge, the widget, the scene action, the release script and the consistency between the manifest and the code. The full wiring (`src/app.js`) is tested against the SDK’s fake Gladys (`@gladysassistant/integration-sdk/testing`), which refuses the payloads Gladys refuses. The CI runs the checks on Node 22 and 24 and builds the Docker image; Dependabot keeps the npm dependencies and the GitHub Actions up to date.

Every user-visible change adds a line under `## [Unreleased]` in [`CHANGELOG.md`](./CHANGELOG.md). To check the manifest with the catalog tool before publishing:

```bash
npx github:GladysAssistant/integration-store .
```

## Publishing

Run **Actions → Release → Run workflow** and pick the version bump. The workflow:

1. bumps `package.json`, `package-lock.json` and the manifest (`version` and the `docker_image` tag);
2. moves the `[Unreleased]` section of `CHANGELOG.md` under the new version;
3. commits the bump and pushes the `vX.Y.Z` tag;
4. builds and pushes the `linux/amd64` + `linux/arm64` image to `ghcr.io/gboulvin/gladys-immich` (`:X.Y.Z` and `:latest`);
5. publishes the GitHub Release of the tag, with its changelog section as notes.

The repository needs the `gladys-assistant-integration` topic and a public GHCR package: the Gladys catalog then indexes the manifest and the image [3]. The `cover.jpg` cover follows the catalog format: an **800 × 534 px** JPEG under **150 KB** [3].

## License

Apache-2.0.

## References

[1]: https://github.com/GladysAssistant/integration-template-js 'Official Gladys JavaScript external-integration template'
[2]: https://community.gladysassistant.com/t/integration-immich 'Community proposal for the Immich integration'
[3]: https://gladysassistant.com/docs/dev/external-integrations/ 'Gladys external integrations documentation'
[4]: https://api.immich.app/endpoints/albums/getAllAlbums 'Immich — list albums'
[5]: https://api.immich.app/endpoints/albums/getAlbumInfo 'Immich — album info'
[6]: https://api.immich.app/endpoints/memories/searchMemories 'Immich — search memories'
[7]: https://api.immich.app/endpoints/assets/viewAsset 'Immich — view asset'
