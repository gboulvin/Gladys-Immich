import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  asGladysCameraImage,
  MAX_CAMERA_IMAGE_BYTES,
  toCameraImage,
} from '../src/imageTransformer.js';

test('converts an Immich preview to a compact JPEG camera payload', async () => {
  const input = await sharp({
    create: { width: 1600, height: 1000, channels: 3, background: { r: 30, g: 80, b: 150 } },
  })
    .png()
    .toBuffer();

  const image = await toCameraImage(input);

  assert.equal(image.contentType, 'image/jpeg');
  assert.ok(image.buffer.length <= MAX_CAMERA_IMAGE_BYTES);
  assert.match(asGladysCameraImage(image), /^image\/jpeg;base64,/);

  const metadata = await sharp(image.buffer).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.ok(metadata.width <= 1280);
});
