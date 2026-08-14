import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  asGladysCameraImage,
  ImageSizeError,
  MAX_CAMERA_IMAGE_BYTES,
  MAX_CAMERA_IMAGE_STRING_LENGTH,
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
  const cameraPayload = asGladysCameraImage(image);
  assert.match(cameraPayload, /^image\/jpeg;base64,/);
  assert.ok(cameraPayload.length <= MAX_CAMERA_IMAGE_STRING_LENGTH);

  const metadata = await sharp(image.buffer).metadata();
  assert.equal(metadata.format, 'jpeg');
  assert.ok(metadata.width <= 1280);
});

test('rejects a Base64 camera payload larger than the SDK limit', () => {
  assert.throws(
    () => asGladysCameraImage({ contentType: 'image/jpeg', buffer: Buffer.alloc(120 * 1024) }),
    ImageSizeError,
  );
});
