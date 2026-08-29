import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const componentsRoot = resolve(import.meta.dir, '../../components');

describe('shared row-item boundary', () => {
  test('suppresses a divider on both sides of a hovered row', () => {
    const shared = readFileSync(resolve(import.meta.dir, '_row-item.css'), 'utf8');

    expect(shared).toContain('.cinder-_row-item:hover::after');
    expect(shared).toContain('.cinder-_row-item:has(+ .cinder-_row-item:hover)::after');
    expect(shared).toMatch(/\.cinder-_row-item:hover[\s\S]*?visibility:\s*hidden/);
  });

  test('is composed by the option-like families only', () => {
    const shared = readFileSync(resolve(import.meta.dir, '_row-item.css'), 'utf8');
    const floatingSurface = readFileSync(
      resolve(import.meta.dir, '_floating-surface.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(shared).toContain('.cinder-_row-item');
    expect(shared).toContain('.cinder-_option-row');
    // The primitive owns the shared option-row padding, tuned once here.
    expect(shared).toContain('padding: var(--cinder-space-1-5) var(--cinder-space-2);');
    expect(floatingSurface).not.toContain('.cinder-_option-row');
    for (const family of ['dropdown-item', 'command-item', 'navigation-item']) {
      expect(readFileSync(resolve(componentsRoot, family, `${family}.svelte`), 'utf8')).toContain(
        'cinder-_row-item',
      );
    }
    for (const family of ['combobox', 'autocomplete', 'multi-select', 'transfer-list']) {
      expect(readFileSync(resolve(componentsRoot, family, `${family}.svelte`), 'utf8')).toContain(
        'cinder-_option-row',
      );
    }
    for (const family of [
      'selectable-row',
      'stacked-list-item',
      'grid-list-item',
      'choice-grid-item',
      'tree-item',
    ]) {
      expect(
        readFileSync(resolve(componentsRoot, family, `${family}.svelte`), 'utf8'),
      ).not.toContain('cinder-_row-item');
    }
  });
});
