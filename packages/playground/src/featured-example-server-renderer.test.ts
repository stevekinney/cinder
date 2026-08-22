import { describe, expect, test } from 'bun:test';

import { renderFeaturedExample } from './featured-example-server-renderer.ts';

describe('featured example server renderer', () => {
  test('renders the featured scenario with the same mount prefix used by client hydration', async () => {
    const rendered = await renderFeaturedExample('banner', 'basic', 'overview-mount-basic');

    expect(rendered.body).toContain('cinder-banner');
    expect(rendered.body).toContain('Scheduled maintenance is planned');
  }, 30_000);
});
