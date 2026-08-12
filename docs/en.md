# Immich Slideshow for Gladys

## Purpose

This external Gladys integration turns an **Immich album** or the **Memories — on this day** collection into a virtual camera. Add that camera to the Gladys dashboard to display an automatically changing photo slideshow. Photos remain on the configured Immich server: the integration requests only Immich preview renditions and never downloads originals.

The integration is designed for Gladys **4.85.0 or newer**. It uses the established camera-image channel so the slideshow can be displayed on the current dashboard immediately. The photo selection module is also separated from the camera adapter, ready for the future native Photo-widget provider API announced by Gladys.

## Prerequisites

You need a reachable Immich server and an API key created in **Immich → Account settings → API keys**. Grant the key the following least-privilege permissions:

| Permission    | Why it is needed                                    |
| ------------- | --------------------------------------------------- |
| `album.read`  | Lists albums and reads the chosen album.            |
| `asset.view`  | Downloads a preview image for the dashboard camera. |
| `memory.read` | Reads the optional “on this day” memory source.     |

The Gladys container must be able to reach the URL entered in the configuration form. For a server on your local network, use its LAN address and Immich port, for example `http://192.168.1.20:2283`. Do not use `localhost`: it refers to the isolated integration container, not to the Gladys host or the Immich server.

## Setup

Open **Integrations → Immich Slideshow → Configuration** and enter the server URL and API key. Select **Album** or **Memories — on this day**. For an album, copy its UUID from the URL shown by Immich and paste it in **Album UUID**. The button **Test Immich connection** confirms that Gladys can list albums with the configured key.

Choose the slide interval, how often the source list is refreshed, and the maximum number of images to keep. The source refresh is deliberately independent from the slide interval: a large album is listed only periodically while individual preview images are downloaded only when they are displayed. Videos are excluded. By default, the newest images appear first; enable random order to shuffle each refreshed list.

Save the configuration, open the integration’s **Discovery** tab, and create the **Immich slideshow** camera. Add this camera to a Gladys dashboard camera box. The first image is published immediately, then the camera updates at the configured slide interval. Use **Refresh slideshow now** after changing images or to immediately fetch today’s new memories.

## Privacy and image handling

The API key is declared as a Gladys `secret`, so it is securely stored and is never returned to the dashboard browser. Requests sent to Immich include the `x-api-key` header inside the integration container. Preview images are corrected for orientation, resized and JPEG-compressed before they are sent through Gladys’s camera channel; this keeps the dashboard fluid and respects the channel’s payload limit.

## Troubleshooting

If the connection test reports an invalid key or permissions, recreate an Immich API key with the three permissions listed above. If the server is unreachable, verify the URL from the Gladys host network and make sure a reverse proxy, firewall or Docker network does not prevent the external-integration container from reaching Immich. An empty album or an empty memory collection is a normal state; add photos or choose another source. The integration log in the Gladys Configuration tab contains the HTTP-level failure category without exposing your API key.

## Current dashboard model and future photo widget

Gladys 4.85’s native **Photo** widget accepts a manually managed URL list; it does not yet expose an external photo-source API. This project therefore delivers a working dashboard slideshow through a virtual camera device today. The independent `src/photoProvider.js` layer already resolves albums and memories to normalized photo metadata and captions, so it is ready to be connected to the future native Photo-widget provider contract without rewriting the Immich client.

## References

[1] [Immich API endpoints](https://api.immich.app/endpoints)
[2] [Gladys external integrations](https://gladysassistant.com/docs/dev/external-integrations/)
[3] [Gladys 4.85 Photo widget announcement](https://community.gladysassistant.com/t/gladys-assistant-4-85-0-widget-photo-navigation-dans-les-graphiques-chauffe-eau-homekit/10483)
