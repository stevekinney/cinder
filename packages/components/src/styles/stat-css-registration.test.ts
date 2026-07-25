import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

describe('stat CSS registration', () => {
  test('components.css imports statistic.css and statistic-group.css', async () => {
    const componentsCssPath = join(import.meta.dir, 'components.css');
    const contents = await Bun.file(componentsCssPath).text();
    expect(contents).toMatch(/@import\s+['"]\.\.\/components\/statistic\/statistic\.css['"];/);
    expect(contents).toMatch(
      /@import\s+['"]\.\.\/components\/statistic-group\/statistic-group\.css['"];/,
    );
  });

  test('keeps monospace token and platform font identifiers canonical', async () => {
    const tokensBaseCssPath = join(import.meta.dir, 'tokens-base.css');
    const contents = await Bun.file(tokensBaseCssPath).text();

    expect(contents).toContain('--cinder-font-mono');
    expect(contents).toContain('ui-monospace');
    expect(contents).toContain('SFMono-Regular');
    expect(contents).toContain('SF Mono');
    expect(contents).toContain('Liberation Mono');
    expect(contents).toContain('monospace');

    expect(contents).not.toContain('--cinder-font-monochrome');
    expect(contents).not.toContain('ui-monochromespace');
    expect(contents).not.toContain('SFMonochrome-Regular');
    expect(contents).not.toContain('SF Monochrome');
    expect(contents).not.toContain('Liberation Monochrome');
    expect(contents).not.toContain('monochromespace');
  });
});
