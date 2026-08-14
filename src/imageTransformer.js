// -----------------------------------------------------------------------------
// Camera image payloads have a strict size limit in Gladys. The SDK checks the
// complete `image/jpeg;base64,...` string, not only the binary JPEG buffer.
// -----------------------------------------------------------------------------

import sharp from 'sharp';

export const CAMERA_IMAGE_PREFIX = 'image/jpeg;base64,';
export const MAX_CAMERA_IMAGE_STRING_LENGTH = 150 * 1024;
// Base64 expands binary data by roughly 4/3. Keep a small safety margin for
// padding and the data-URL prefix so SDK validation can never reject a slide.
export const MAX_CAMERA_IMAGE_BYTES = 108 * 1024;

const ENCODING_STEPS = [
  { width: 1_280, quality: 72 },
  { width: 1_024, quality: 62 },
  { width: 800, quality: 52 },
  { width: 640, quality: 42 },
  { width: 480, quality: 34 },
  { width: 360, quality: 28 },
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
  const image = `${contentType};base64,${buffer.toString('base64')}`;
  if (image.length > MAX_CAMERA_IMAGE_STRING_LENGTH) {
    throw new ImageSizeError(image.length);
  }
  return image;
}
