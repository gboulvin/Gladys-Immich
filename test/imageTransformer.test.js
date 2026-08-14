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

test('renders an optional Immich caption in the camera image budget', async () => {
  const input = await sharp({
    create: { width: 1000, height: 650, channels: 3, background: { r: 60, g: 100, b: 140 } },
  })
    .png()
    .toBuffer();

  const withoutCaption = await toCameraImage(input);
  const withCaption = await toCameraImage(input, {
    caption: 'Family holidays — Rome — 12 August 2024',
  });

  assert.ok(withCaption.buffer.length <= MAX_CAMERA_IMAGE_BYTES);
  assert.notDeepEqual(withCaption.buffer, withoutCaption.buffer);
  assert.ok(asGladysCameraImage(withCaption).length <= MAX_CAMERA_IMAGE_STRING_LENGTH);
});
