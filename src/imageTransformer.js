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
const MAX_CAPTION_LENGTH = 240;
const CAPTION_PADDING = 20;
const CAPTION_LINE_HEIGHT = 25;
const CAPTION_FONT_SIZE = 20;

export class ImageSizeError extends Error {
  constructor(size) {
    super(`The Immich preview could not be reduced below the Gladys camera limit (${size} bytes).`);
    this.name = 'ImageSizeError';
    this.code = 'IMAGE_TOO_LARGE';
  }
}

function escapeXml(value) {
  return value.replace(/[<>&'"]/g, (character) => {
    const entities = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      "'": '&apos;',
      '"': '&quot;',
    };
    return entities[character];
  });
}

function captionLines(caption, width) {
  const normalized = String(caption ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) {
    return [];
  }

  const shortened =
    normalized.length > MAX_CAPTION_LENGTH
      ? `${normalized.slice(0, MAX_CAPTION_LENGTH - 1).trimEnd()}…`
      : normalized;
  const maximumCharacters = Math.max(24, Math.floor((width - CAPTION_PADDING * 2) / 11));
  const lines = [];
  let line = '';

  for (const word of shortened.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maximumCharacters && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines.slice(0, 3);
}

function captionOverlay(caption, width) {
  const lines = captionLines(caption, width);
  if (lines.length === 0) {
    return null;
  }

  const height = CAPTION_PADDING * 2 + CAPTION_LINE_HEIGHT * lines.length;
  const text = lines
    .map(
      (line, index) =>
        `<text x="${CAPTION_PADDING}" y="${CAPTION_PADDING + CAPTION_FONT_SIZE + index * CAPTION_LINE_HEIGHT}">${escapeXml(line)}</text>`,
    )
    .join('');
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#000000" fill-opacity="0.72"/><style>text { fill: #ffffff; font-family: sans-serif; font-size: ${CAPTION_FONT_SIZE}px; font-weight: 600; }</style>${text}</svg>`;

  return {
    input: Buffer.from(svg),
    gravity: 'south',
  };
}

/**
 * Convert an Immich preview to an EXIF-oriented JPEG suitable for Gladys.
 * When a caption is provided, render it as a high-contrast band at the bottom
 * of the image before applying the same camera-payload size budget.
 * @param {Buffer} input
 * @param {{caption?: string}} options
 * @returns {Promise<{contentType: 'image/jpeg', buffer: Buffer}>}
 */
export async function toCameraImage(input, { caption = '' } = {}) {
  let lastBuffer = input;

  for (const { width, quality } of ENCODING_STEPS) {
    const resized = await sharp(input, { animated: false })
      .rotate()
      .resize({ width, withoutEnlargement: true, fit: 'inside' })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    const metadata = await sharp(resized).metadata();
    const overlay = captionOverlay(caption, metadata.width ?? width);
    lastBuffer = overlay
      ? await sharp(resized).composite([overlay]).jpeg({ quality, mozjpeg: true }).toBuffer()
      : resized;

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
