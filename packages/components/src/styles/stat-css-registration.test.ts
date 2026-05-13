import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

describe('stat CSS registration', () => {
  test('components.css imports stat.css and stat-group.css', async () => {
    const componentsCssPath = join(import.meta.dir, 'components.css');
    const contents = await Bun.file(componentsCssPath).text();
    expect(contents).toMatch(/@import\s+['"]\.\/components\/stat\.css['"];/);
    expect(contents).toMatch(/@import\s+['"]\.\/components\/stat-group\.css['"];/);
  });
});
