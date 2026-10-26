# Immich Slideshow for Gladys

## Purpose

This external Gladys integration turns one or more **Immich albums** or the **Memories — on this day** collection into a virtual camera. Add that camera to the Gladys dashboard to display an automatically changing photo slideshow. Photos remain on the configured Immich server: the integration requests only Immich preview renditions and never downloads originals.

The integration requires Gladys **5.3.0 or newer**. Each slideshow is a virtual camera, usable in a dashboard camera box. The integration also adds an **Immich photo dashboard widget** and a **scene action** that shows the next photo. It is available in English, French, German and Spanish.

## Prerequisites

You need a reachable Immich server and an API key created in **Immich → Account settings → API keys**. Grant the key the following least-privilege permissions:

| Permission    | Why it is needed                                     |
| ------------- | ---------------------------------------------------- |
| `album.read`  | Lists albums and reads the chosen album.             |
| `asset.read`  | Searches the assets belonging to the selected album. |
| `asset.view`  | Downloads a preview image for the dashboard camera.  |
| `memory.read` | Reads the optional “on this day” memory source.      |

The Gladys container must be able to reach the URL entered in the configuration form. For a server on your local network, use its LAN address and Immich port, for example `http://192.168.1.20:2283`. Do not use `localhost`: it refers to the isolated integration container, not to the Gladys host or the Immich server.

## Setup

Open **Integrations → Immich Slideshow → Configuration** and enter the server URL and API key for **Slideshow 1**. Select **Album** or **Memories — on this day**. For one or more albums, click **List Immich albums** after entering the server URL and API key. The action returns each album name, UUID and asset count; enter one or more UUIDs into **Album UUIDs**, separated by commas or line breaks. The integration merges the albums, deduplicates shared photos and applies the image cap to the combined source. The button **Test Immich connection** confirms that Gladys can list albums with the configured key.

Choose the slide interval, how often the source list is refreshed, and the maximum number of images to keep. Enable **Show Immich caption** to add the available Immich description, location and capture date in a readable band at the bottom of each image. **Caption language** sets the language of the date in that band (English, French, German or Spanish) and of the source name returned by the scene action; the dashboard widget always uses the language of each viewer. The source refresh is deliberately independent from the slide interval: a large album is listed only periodically while individual preview images are downloaded only when they are displayed. Videos are excluded. By default, the newest images appear first; enable random order to shuffle each refreshed list.

Save the configuration, open the integration’s **Discovery** tab, and create the **Immich slideshow** camera. You can also create **Immich slideshow 2**: its profile is fully independent and can use a different album, memories source, intervals, caption setting, or even a different Immich server. Complete the **Slideshow 2** fields before creating this second camera, then use its dedicated connection-test, album-list and refresh buttons. Add each camera to a camera box on the Gladys dashboard of your choice, so the first camera can be used on one dashboard and the second on another. Each first image is published immediately, then each camera updates at its own configured interval.

## Connection status and transport badge

The **Configuration** tab shows one connection status for the integration: it turns red as soon as a configured slideshow fails, with the reason (server unreachable, key refused, empty source…), and turns green again on its own once the slideshow works again. A successful **Test** or **Refresh** click also clears a stale error.

Each camera also carries a transport badge. It reads **local** when the Immich URL points to your home network (a private address such as `192.168.x.x`, a `.local`, `.lan` or `.home.arpa` name, a short container name, a Tailscale address), **cloud** when it goes over the Internet (public domain name, reverse proxy, tunnel) and **unreachable** when Immich does not answer. An orange dot means Immich answers but the slideshow cannot run: hover the badge to read the reason. Since each slideshow has a single Immich URL, the **Prefer the local connection** toggle of the configuration screen has no effect: to go local, enter the local network address of your server.

## Privacy and image handling

The API key is declared as a Gladys `secret`, so it is securely stored and is never returned to the dashboard browser. Requests sent to Immich include the `x-api-key` header inside the integration container. Preview images are corrected for orientation, resized and JPEG-compressed before they are sent through Gladys’s camera channel; this keeps the dashboard fluid and respects the channel’s payload limit. When enabled, the selected Immich metadata is burned into a high-contrast band at the bottom of the preview and therefore travels with the camera image to the dashboard.

## Troubleshooting

If the connection test reports an invalid key or permissions, recreate an Immich API key with the four permissions listed above. If an album is reported as empty while it contains photos, update to this release: newer Immich versions expose album metadata separately from their assets, which the integration now retrieves through the album-filtered metadata search API. If the server is unreachable, verify the URL from the Gladys host network and make sure a reverse proxy, firewall or Docker network does not prevent the external-integration container from reaching Immich. An empty album or an empty memory collection is a normal state; add photos or choose another source. The integration log in the Gladys Configuration tab contains the HTTP-level failure category without exposing your API key.

## “Immich photo” widget

While editing the dashboard, add the **Immich photo** widget and pick, in its settings, the slideshow camera to follow (the camera must have been created in the **Discovery** tab). The widget shows the photo on display, its caption when the burned-in caption option is off, the slideshow state, how the Immich server is reached (local or cloud), the source and the number of photos. The **Next photo** button moves the camera on immediately; **Refresh** reads the album or today’s memories again. The widget follows the camera: it updates at every new photo. When something goes wrong, it shows the reason instead of the photo.

## “Show the next Immich photo” scene action

In a scene, the **Show the next Immich photo** action moves the chosen camera on, optionally re-reading the source first. It produces three variables for the following actions: **Photo displayed** (true or false), **Photo file name** and **Album or memories**. A slideshow that is not configured or failing does not fail the scene: **Photo displayed** is then false, so the rest of the scene can depend on it.

Example: every morning at 8 am, show the next photo of today’s memories, then, if **Photo displayed** is true, send it in a message with the built-in **Send camera image** action.

## References

[1] [Immich API endpoints](https://api.immich.app/endpoints)
[2] [Gladys external integrations](https://gladysassistant.com/docs/dev/external-integrations/)
