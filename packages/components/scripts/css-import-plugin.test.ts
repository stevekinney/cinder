import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'bun:test';

import { componentStylesSpecifier } from './css-import-plugin.ts';
import { discoverComponents } from './lib/discover-components.ts';
import { hasSourceCssImport } from './prepend-source-index-css-import.ts';

const componentsRoot = join(import.meta.dir, '..', 'src', 'components');

function componentDirectory(name: string, isExperimental: boolean): string {
  return isExperimental ? join(componentsRoot, 'experimental', name) : join(componentsRoot, name);
}

describe('component CSS auto-import contract', () => {
  it('uses the public styles export for normal and experimental components', () => {
    expect(componentStylesSpecifier('button', false)).toBe('@lostgradient/cinder/button/styles');
    expect(componentStylesSpecifier('lab', true)).toBe(
      '@lostgradient/cinder/experimental/lab/styles',
    );
  });

  it('keeps every Svelte source entry with a sidecar styled automatically', async () => {
    const missing: string[] = [];
    for (const component of await discoverComponents()) {
      const directory = componentDirectory(component.name, component.isExperimental);
      if (!existsSync(join(directory, `${component.name}.css`))) continue;
      const indexPath = join(directory, 'index.ts');
      if (!hasSourceCssImport(await Bun.file(indexPath).text(), component.name))
        missing.push(indexPath);
    }
    expect(missing).toEqual([]);
  });
});
