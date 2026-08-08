import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const componentsRoot = resolve(import.meta.dir, '../../components');

describe('shared label/value hierarchy', () => {
  test('defines every axis of the shared hierarchy', () => {
    const css = readFileSync(resolve(import.meta.dir, '_label-value.css'), 'utf8');

    expect(css).toContain('color: var(--cinder-text);');
    expect(css).toContain('font-size: var(--cinder-text-base);');
    expect(css).toContain('font-weight: var(--cinder-font-semibold);');
    expect(css).toContain('line-height: var(--cinder-leading-snug);');
    expect(css).toContain('color: var(--cinder-text-muted);');
    expect(css).toContain('font-size: var(--cinder-text-sm);');
    expect(css).toContain('font-weight: var(--cinder-font-normal);');
    expect(css).toContain('line-height: var(--cinder-leading-normal);');
  });

  test.each([
    ['access-gate/access-gate.svelte', 'cinder-_label-text', 'cinder-_value-text'],
    ['capability-gate/capability-gate.svelte', 'cinder-_label-text', 'cinder-_value-text'],
    ['description-list/description-list.svelte', 'cinder-_label-text', 'cinder-_value-text'],
    ['footer/footer.svelte', 'cinder-_label-text', 'cinder-_value-text'],
  ])('%s composes the shared label and value roles', (relativePath, labelClass, valueClass) => {
    const source = readFileSync(resolve(componentsRoot, relativePath), 'utf8');

    expect(source).toContain(labelClass);
    expect(source).toContain(valueClass);
  });
});
