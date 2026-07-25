import { readFileSync } from 'node:fs';

import { expect, test } from '@playwright/test';

test('LogoCloud computes a distinct grid track for every supported column value', async ({
  page,
}) => {
  const logoCloudCss = readFileSync(
    new URL('../../components/src/components/logo-cloud/logo-cloud.css', import.meta.url),
    'utf8',
  );

  await page.setContent(`
    <style>
      ${logoCloudCss}
      .cinder-logo-cloud {
        inline-size: 600px;
      }
    </style>
    ${[2, 3, 4, 5, 6]
      .map(
        (columns) => `
          <section class="cinder-logo-cloud" data-cinder-columns="${columns}">
            <ul class="cinder-logo-cloud__list" data-testid="columns-${columns}">
              ${Array.from({ length: columns }, () => '<li></li>').join('')}
            </ul>
          </section>
        `,
      )
      .join('')}
    <section class="cinder-logo-cloud">
      <ul class="cinder-logo-cloud__list" data-testid="columns-default">
        <li></li>
        <li></li>
      </ul>
    </section>
  `);

  for (const columns of [2, 3, 4, 5, 6]) {
    const computedTracks = await page
      .getByTestId(`columns-${columns}`)
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' '));
    expect(computedTracks).toHaveLength(columns);
  }

  const defaultTracks = await page
    .getByTestId('columns-default')
    .evaluate((element) => getComputedStyle(element).gridTemplateColumns.split(' '));
  expect(defaultTracks).toHaveLength(2);
});
