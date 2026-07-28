import { expect, test } from '../src/fixtures/component-page.ts';
import { loadManifest, VIEWPORTS } from '../src/helpers/manifest.ts';

const desktop = VIEWPORTS.find((viewport) => viewport.name === 'desktop');
const phoneInputEntry = loadManifest().find((entry) => entry.slug === 'phone-input');

if (!phoneInputEntry) {
  throw new Error('Cached testing manifest does not include slug "phone-input".');
}

if (!desktop) {
  throw new Error('Desktop viewport fixture is missing.');
}

test('country control stays compact for a long country name', async ({ componentPage }) => {
  const page = await componentPage.open({
    entry: phoneInputEntry,
    theme: 'light',
    viewport: desktop,
  });

  const country = page.locator('#example-mount-basic-field-country');
  const countryControl = page.locator('.cinder-phone-input__country', { has: country });
  await country.selectOption('AE');
  await expect(country).toHaveValue('AE');
  await expect(country).toHaveAccessibleName('Phone number Country: United Arab Emirates, +971');
  await expect(countryControl.locator('.cinder-phone-input__country-summary')).toHaveText(
    'AE +971',
  );
  await expect(country.locator('option[value="AE"]')).toHaveText('United Arab Emirates +971');

  const countryBox = await countryControl.boundingBox();
  const nationalBox = await page.locator('#example-mount-basic-field').boundingBox();
  expect(countryBox).not.toBeNull();
  expect(nationalBox).not.toBeNull();
  expect(countryBox!.width).toBeLessThanOrEqual(160);
  expect(nationalBox!.width).toBeGreaterThan(countryBox!.width);
});
