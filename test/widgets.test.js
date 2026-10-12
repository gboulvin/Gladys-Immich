// -----------------------------------------------------------------------------
// The `immich_photo` dashboard widget, through the fake Gladys of the SDK.
// `validateWidgetContent(...)` returning [] means the core renders the content
// exactly as sent: nothing dropped by the vocabulary or the content budget.
// -----------------------------------------------------------------------------

import assert from 'node:assert/strict';
import test from 'node:test';
import { validateWidgetContent, validateWidgetImage } from '@gladysassistant/integration-sdk';
import { ImmichApiError } from '../src/immichClient.js';
import { PHOTO_WIDGET } from '../src/widgets.js';
import { FIRST_PROFILE, settle, setup } from './helpers.js';

async function connected(t, options) {
  const context = setup(options);
  t.after(() => context.app.stop());
  await context.gladys.connect();
  await settle();
  const camera = context.blueprints[0].deviceExternalId(context.gladys);
  return { ...context, settings: { camera } };
}

const componentsOf = (ack) => ack.data.content.components;
const ofType = (ack, type) => componentsOf(ack).filter((component) => component.type === type);

test('shows the current photo, its caption, the slideshow state and the buttons', async (t) => {
  const { gladys, settings } = await connected(t);

  const ack = await gladys.fake.widgetGet(PHOTO_WIDGET, { settings });
  assert.equal(ack.success, true);
  assert.deepEqual(validateWidgetContent(ack.data.content), []);
  assert.equal(ack.data.content.ttl_seconds, 60, 'the content follows the slide interval');

  const [image] = ofType(ack, 'image');
  assert.match(image.key, /^slide-1-0a1b2c3d-/);
  assert.equal(image.alt, 'IMG_1.jpg');
  assert.equal(ofType(ack, 'text')[0].text, 'Biarritz · 14 juillet 2024');

  const [status] = ofType(ack, 'status');
  assert.deepEqual(
    status.items.map((item) => [item.label.en, item.value.en ?? item.value]),
    [
      ['Slideshow', 'Running'],
      ['Immich server', 'Local'],
      ['Source', 'Holidays'],
      ['Photos', '12 / 40'],
    ],
  );
  assert.deepEqual(
    ofType(ack, 'button').map((button) => button.action.key),
    ['next', 'refresh'],
  );
});

test('serves the declared image within the widget bounds', async (t) => {
  const { gladys, settings } = await connected(t);
  const [image] = ofType(await gladys.fake.widgetGet(PHOTO_WIDGET, { settings }), 'image');

  const ack = await gladys.fake.widgetGetImage(image.key);
  assert.equal(ack.success, true);
  assert.deepEqual(validateWidgetImage(ack.data.image), []);

  assert.equal((await gladys.fake.widgetGetImage('slide-1-unknown')).success, false);
});

test('the caption band switches the image key and hides the duplicate text', async (t) => {
  const { gladys, settings } = await connected(t, {
    config: { ...FIRST_PROFILE, show_caption: true },
  });
  const ack = await gladys.fake.widgetGet(PHOTO_WIDGET, { settings });
  assert.match(ofType(ack, 'image')[0].key, /^slide-1c-/);
  assert.equal(ofType(ack, 'text').length, 0);
});

test('the next button shows another photo on the camera', async (t) => {
  const { gladys, settings } = await connected(t);
  const images = gladys.fake.cameraImages.length;

  const ack = await gladys.fake.widgetAction(PHOTO_WIDGET, 'next', {}, { settings });
  assert.equal(ack.success, true);
  assert.match(ack.data.message.fr, /IMG_2\.jpg/);
  assert.equal(gladys.fake.cameraImages.length, images + 1);

  const content = await gladys.fake.widgetGet(PHOTO_WIDGET, { settings });
  assert.equal(ofType(content, 'image')[0].alt, 'IMG_2.jpg');

  assert.equal(
    (await gladys.fake.widgetAction(PHOTO_WIDGET, 'refresh', {}, { settings })).success,
    true,
  );
  assert.equal(
    (await gladys.fake.widgetAction(PHOTO_WIDGET, 'nope', {}, { settings })).success,
    false,
  );
});

test('a failing slideshow shows the reason instead of the buttons failing silently', async (t) => {
  const { gladys, settings } = await connected(t, {
    failNext: new ImmichApiError('down', { code: 'UNREACHABLE' }),
  });
  const ack = await gladys.fake.widgetGet(PHOTO_WIDGET, { settings });
  assert.deepEqual(validateWidgetContent(ack.data.content), []);
  assert.equal(ofType(ack, 'image').length, 0);
  assert.match(ofType(ack, 'text')[0].text.fr, /inaccessible/);
  assert.equal(ofType(ack, 'status')[0].items[0].value.en, 'Unreachable');
});

test('asks to pick a camera, or to finish the configuration', async (t) => {
  const { gladys, blueprints } = await connected(t);

  const noCamera = await gladys.fake.widgetGet(PHOTO_WIDGET, { settings: {} });
  assert.deepEqual(validateWidgetContent(noCamera.data.content), []);
  assert.match(ofType(noCamera, 'text')[0].text.en, /Choose an Immich slideshow camera/);

  // Slideshow 2 exists as a device but is not configured.
  const second = { camera: blueprints[1].deviceExternalId(gladys) };
  const idle = await gladys.fake.widgetGet(PHOTO_WIDGET, { settings: second });
  assert.deepEqual(validateWidgetContent(idle.data.content), []);
  assert.equal(ofType(idle, 'button').length, 0);
  assert.equal(ofType(idle, 'status')[0].items[0].value.en, 'Not configured');
});

test('every new slide nudges the widget, so open dashboards follow the camera', async (t) => {
  const { gladys } = await connected(t);
  assert.ok(gladys.fake.widgetRefreshes.includes(PHOTO_WIDGET));
});
