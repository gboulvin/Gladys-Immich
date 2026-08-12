// -----------------------------------------------------------------------------
// Camera image payloads have a strict size limit in Gladys. Immich previews can
// occasionally exceed it, especially for detailed photographs, so re-encode
// every slide locally before publishing it through the camera channel.
// -----------------------------------------------------------------------------

import sharp from 'sharp';

export const MAX_CAMERA_IMAGE_BYTES = 145 * 1024;

const ENCODING_STEPS = [
  { width: 1_280, quality: 78 },
  { width: 1_024, quality: 68 },
  { width: 800, quality: 58 },
  { width: 640, quality: 48 },
];

export class ImageSizeError extends Error {
  constructor(size) {
    super(`The Immich preview could not be reduced below the Gladys camera limit (${size} bytes).`);
    this.name = 'ImageSizeError';
    this.code = 'IMAGE_TOO_LARGE';
  }
}

/**
 * Convert an Immich preview to an EXIF-oriented JPEG suitable for Gladys.
 * @param {Buffer} input
 * @returns {Promise<{contentType: 'image/jpeg', buffer: Buffer}>}
 */
export async function toCameraImage(input) {
  let lastBuffer = input;

  for (const { width, quality } of ENCODING_STEPS) {
    lastBuffer = await sharp(input, { animated: false })
      .rotate()
      .resize({ width, withoutEnlargement: true, fit: 'inside' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();

    if (lastBuffer.length <= MAX_CAMERA_IMAGE_BYTES) {
      return { contentType: 'image/jpeg', buffer: lastBuffer };
    }
  }

  throw new ImageSizeError(lastBuffer.length);
}

export function asGladysCameraImage({ contentType, buffer }) {
  return `${contentType};base64,${buffer.toString('base64')}`;
}
