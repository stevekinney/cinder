import { describe, expect, test } from 'bun:test';

import {
  removeHydrationMarkers,
  renderFeaturedExample,
} from './featured-example-server-renderer.ts';

describe('featured example server renderer', () => {
  test('removes every Svelte hydration marker form without touching authored comments', () => {
    const html =
      '<!----><!--$--><!--/$--><!--[--><!--[!--><!--[0--><!--[-1--><!--[?{"message":"nope"}--><!--]--><!-- keep -->';

    expect(removeHydrationMarkers(html)).toBe('<!-- keep -->');
  });

  test('renders the featured scenario with the same mount prefix used by client hydration', async () => {
    const rendered = await renderFeaturedExample('banner', 'basic', 'overview-mount-basic');

    expect(rendered.body).toContain('cinder-banner');
    expect(rendered.body).toContain('Scheduled maintenance is planned');
    expect(rendered.body).not.toContain('<!--');
  });
});
