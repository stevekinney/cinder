import { describe, expect, test } from 'bun:test';

import {
  normalizeBrowserSerializedHtml,
  removeHydrationMarkers,
  renderFeaturedExample,
} from './featured-example-server-renderer.ts';

describe('featured example server renderer', () => {
  test('removes every Svelte hydration marker form without touching authored comments', () => {
    const html =
      '<!----><!--$--><!--/$--><!--[--><!--[!--><!--[0--><!--[-1--><!--[?{"message":"nope"}--><!--]--><!-- keep -->';

    expect(removeHydrationMarkers(html)).toBe('<!-- keep -->');
  });

  test('normalizes self-closing HTML void elements to browser innerHTML syntax', () => {
    expect(
      normalizeBrowserSerializedHtml(
        '<input type="text"/><br/><img src="preview.png"/><svg><path d="M0 0"/></svg>',
      ),
    ).toBe('<input type="text"><br><img src="preview.png"><svg><path d="M0 0"/></svg>');
  });

  test('emits the generated example import as a normalized relative specifier', async () => {
    const workerSource = await Bun.file(
      new URL('./featured-example-server-worker.ts', import.meta.url),
    ).text();

    expect(workerSource).toContain(
      "relative(dirname(entryPath), examplePath).split(sep).join('/')",
    );
    expect(workerSource).toContain('JSON.stringify(exampleImportSpecifier)');
    expect(workerSource).not.toContain('JSON.stringify(examplePath)');
  });

  test('renders the featured scenario with the same mount prefix used by client hydration', async () => {
    const rendered = await renderFeaturedExample('banner', 'basic', 'overview-mount-basic');

    expect(rendered.body).toContain('cinder-banner');
    expect(rendered.body).toContain('Scheduled maintenance is planned');
    expect(rendered.body).not.toContain('<!--');
  });
});
