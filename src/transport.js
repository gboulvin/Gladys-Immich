// -----------------------------------------------------------------------------
// Transport badge of a slideshow camera.
//
// Immich is reached over HTTP at the URL the user typed: there is no local and
// cloud channel to switch between, so the badge reports where that URL points.
// A private address or a LAN-only hostname is `local`; anything else goes over
// the Internet (a remote Immich, a reverse proxy, a tunnel) and is `cloud`.
// The badge then tells, per camera, why a slideshow is slow or frozen.
// -----------------------------------------------------------------------------

import { DEVICE_TRANSPORTS } from '@gladysassistant/integration-sdk';
import { isIP } from 'node:net';

// Suffixes reserved for names that never resolve on the public Internet.
const LAN_SUFFIXES = ['.local', '.lan', '.home', '.home.arpa', '.internal', '.localdomain'];

function isPrivateIpv4(address) {
  const [a, b] = address.split('.').map(Number);
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    // Carrier-grade NAT, also used by Tailscale and similar private overlays.
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isPrivateIpv6(address) {
  const lower = address.toLowerCase();
  if (lower === '::1') {
    return true;
  }
  // IPv4-mapped addresses: the URL parser writes them in hex (::ffff:c0a8:102).
  const dotted = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    return isPrivateIpv4(dotted[1]);
  }
  const hex = lower.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const [high, low] = [hex[1], hex[2]].map((part) => Number.parseInt(part, 16));
    return isPrivateIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  // fc00::/7 (unique local) and fe80::/10 (link-local).
  return /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
}

/**
 * Tell whether an Immich URL stays on the local network.
 * @param {string} url Normalized Immich server URL.
 * @returns {boolean}
 */
export function isLocalUrl(url) {
  let hostname;
  try {
    hostname = new URL(url).hostname.replace(/^\[|\]$/g, '').toLowerCase();
  } catch {
    return false;
  }
  if (!hostname) {
    return false;
  }

  const ipVersion = isIP(hostname);
  if (ipVersion === 4) {
    return isPrivateIpv4(hostname);
  }
  if (ipVersion === 6) {
    return isPrivateIpv6(hostname);
  }

  // A single-label name (`immich`, `nas`) only resolves through the LAN DNS
  // or a Docker network.
  return (
    hostname === 'localhost' ||
    !hostname.includes('.') ||
    LAN_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  );
}

/**
 * Nominal transport of an Immich URL: `local` or `cloud`.
 * @param {string} url Normalized Immich server URL.
 */
export function transportForUrl(url) {
  return isLocalUrl(url) ? DEVICE_TRANSPORTS.LOCAL : DEVICE_TRANSPORTS.CLOUD;
}
