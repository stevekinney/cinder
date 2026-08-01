import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const componentsRoot = resolve(import.meta.dir, '../../components');

describe('shared row-item boundary', () => {
  test('is composed by the option-like families only', () => {
    const shared = readFileSync(resolve(import.meta.dir, '_row-item.css'), 'utf8');
    expect(shared).toContain('.cinder-_row-item');
    for (const family of ['dropdown-item', 'command-item', 'navigation-item']) {
      expect(readFileSync(resolve(componentsRoot, family, `${family}.svelte`), 'utf8')).toContain(
        'cinder-_row-item',
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
