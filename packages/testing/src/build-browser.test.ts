import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { buildBrowser } from './build-browser.ts';

test('browser HTML assets load from nested fixture and application routes', async () => {
  const directory = await mkdtemp(join(import.meta.dirname, '.browser-build-'));
  try {
    await Bun.write(
      join(directory, 'index.html'),
      '<div id="app"></div><script type="module" src="./main.ts"></script>',
    );
    await Bun.write(
      join(directory, 'main.ts'),
      "import './styles.css'; document.title = 'Browser build';",
    );
    await Bun.write(join(directory, 'styles.css'), 'body { color: rebeccapurple; }');
    const outdir = join(directory, 'build');
    await buildBrowser({
      entrypoints: [join(directory, 'index.html')],
      outdir,
      development: false,
    });
    const html = await Bun.file(join(outdir, 'index.html')).text();
    const urls = Array.from(
      html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="([^"]+)"/g),
      (match) => match[1]!,
    );
    expect(urls).toHaveLength(2);
    for (const reference of urls) {
      const path = new URL(reference, 'http://localhost/page/example').pathname;
      expect(path).not.toStartWith('/page/');
      expect(await Bun.file(join(outdir, path)).exists()).toBe(true);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
