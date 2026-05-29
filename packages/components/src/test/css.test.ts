import { describe, expect, test } from 'bun:test';
import { parse } from 'postcss';

import { stripCinderComponentsLayer } from './css.ts';

/**
 * Parse `css` and return its top-level selectors / at-rule headers, in order.
 * Comments are ignored — they carry no cascade meaning and may legitimately
 * survive a strip.
 */
function topLevelShape(css: string): string[] {
  return parse(css)
    .nodes.filter((node) => node.type !== 'comment')
    .map((node) =>
      node.type === 'rule'
        ? node.selector
        : node.type === 'atrule'
          ? `@${node.name} ${node.params}`.trim()
          : node.type,
    );
}

describe('stripCinderComponentsLayer', () => {
  test('returns source unchanged when there is no wrapper', () => {
    const css = '.cinder-x { color: red; }';
    expect(stripCinderComponentsLayer(css).trim()).toBe(css);
  });

  test('hoists the inner rules out of the wrapper', () => {
    const css = '@layer cinder.components { .cinder-x { color: red; } .cinder-y { color: blue; } }';
    expect(topLevelShape(stripCinderComponentsLayer(css))).toEqual(['.cinder-x', '.cinder-y']);
  });

  test('an empty wrapper strips to no rules', () => {
    expect(topLevelShape(stripCinderComponentsLayer('@layer cinder.components {}'))).toEqual([]);
  });

  test('leaves a wrapper with a different layer name untouched', () => {
    const css = '@layer other { .cinder-x { color: red; } }';
    expect(topLevelShape(stripCinderComponentsLayer(css))).toEqual(['@layer other']);
  });

  test('preserves nested at-rules (@media) when hoisting', () => {
    const css =
      '@layer cinder.components { .cinder-x { color: red; } @media (hover: hover) { .cinder-x:hover { color: blue; } } }';
    expect(topLevelShape(stripCinderComponentsLayer(css))).toEqual([
      '.cinder-x',
      '@media (hover: hover)',
    ]);
  });

  test('braces inside content/url/strings do not corrupt the result', () => {
    const css =
      "@layer cinder.components { .cinder-x::before { content: '}{'; } .cinder-y { background: url('data:image/svg+xml,{}'); } }";
    expect(topLevelShape(stripCinderComponentsLayer(css))).toEqual([
      '.cinder-x::before',
      '.cinder-y',
    ]);
    // The pathological content value survives intact.
    expect(stripCinderComponentsLayer(css)).toContain("content: '}{'");
  });

  test('a closing brace inside a comment does not truncate the strip', () => {
    const css =
      '@layer cinder.components { /* a } brace in a comment */ .cinder-x { color: red; } }';
    expect(topLevelShape(stripCinderComponentsLayer(css))).toEqual(['.cinder-x']);
  });
});
