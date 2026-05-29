import { describe, expect, it } from 'bun:test';

import { checkComponentCssSource } from './check-component-css.ts';

const fakePath = '/virtual/test/component.css';

/**
 * Wrap a fragment of component CSS in the required
 * `@layer cinder.components { … }` sidecar wrapper. The layer assignment is now
 * intrinsic to the file, so every valid sidecar must carry it.
 */
function layered(inner: string): string {
  return `@layer cinder.components {\n${inner}\n}`;
}

describe('checkComponentCssSource', () => {
  it('passes a well-scoped component sidecar', () => {
    const source = layered(`
      .cinder-button {
        background: var(--cinder-button-bg);
        color: var(--cinder-button-fg);
      }
      .cinder-button:hover {
        background: var(--cinder-button-hover-bg);
      }
      .cinder-button[data-variant='primary'] {
        --cinder-button-bg: blue;
      }
    `);
    expect(checkComponentCssSource(source, fakePath)).toEqual([]);
  });

  it('allows leading comments before the layer wrapper', () => {
    const source = `/* license header */\n${layered(`.cinder-button { color: red; }`)}`;
    expect(checkComponentCssSource(source, fakePath)).toEqual([]);
  });

  it('allows scoped descendants of forbidden tags', () => {
    const source = layered(`
      .cinder-button > * { margin-inline-end: 0; }
      .cinder-banner :where(html) { color: inherit; }
    `);
    expect(checkComponentCssSource(source, fakePath)).toEqual([]);
  });

  it('allows class lists nested inside functional pseudos', () => {
    const source = layered(`
      :is(.cinder-button, .cinder-button-group) { color: red; }
      :where(.cinder-card) { padding: 1rem; }
      :not(.cinder-button-icon).cinder-button { font-weight: 600; }
    `);
    expect(checkComponentCssSource(source, fakePath)).toEqual([]);
  });

  it('rejects :root at the top level (inside the layer)', () => {
    const source = layered(`:root { --cinder-color-fg: black; }`);
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe(':root');
  });

  it('rejects :where(:root) — globals hidden inside a functional pseudo', () => {
    const source = layered(`:where(:root) { --cinder-color-fg: black; }`);
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe(':where(:root)');
  });

  it('rejects :is(html, body)', () => {
    const source = layered(`:is(html, body) { font-family: sans-serif; }`);
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe(':is(html, body)');
  });

  it('rejects html and body selectors', () => {
    const source = layered(`html { font-size: 16px; } body { margin: 0; }`);
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.selector)).toEqual(['html', 'body']);
  });

  it('rejects raw tag selectors with no class anchor', () => {
    const source = layered(`button { all: unset; }`);
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe('button');
  });

  it('rejects bare universal selectors', () => {
    const source = layered(`* { box-sizing: border-box; }`);
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe('*');
  });

  it('rejects universal + pseudo at the top level', () => {
    const source = layered(`*:focus { outline: 2px solid blue; }`);
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe('*:focus');
  });

  it('rejects bare attribute selectors at the top level', () => {
    const source = layered(`[data-theme='dark'] { background: black; }`);
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toContain('data-theme');
  });

  it('requires the @layer cinder.components wrapper — bare rules fail', () => {
    const source = `.cinder-button { color: red; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain('@layer cinder.components');
  });

  it('rejects a wrapper with the wrong layer name', () => {
    const source = `@layer components { .cinder-button { color: red; } }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0]?.message).toContain('@layer cinder.components');
  });

  it('rejects rules sitting outside the layer wrapper', () => {
    const source = `${layered(`.cinder-button { color: red; }`)}\n.cinder-leaked { color: blue; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0]?.message).toContain('@layer cinder.components');
  });

  it('rejects @import at-rules', () => {
    const source = layered(`@import './tokens.css'; .cinder-button { color: red; }`);
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations.some((v) => v.message.includes('@import'))).toBe(true);
  });

  it('handles selector lists', () => {
    const source = layered(`.cinder-button, :root { color: red; }`);
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe(':root');
  });

  it('allows data-cinder-* attribute anchors (state-driven scoping)', () => {
    const source = layered(`
      [data-cinder-state='current'] .cinder-steps__marker {
        background: var(--cinder-steps-current-bg);
      }
      [data-cinder-variant='primary'] {
        color: var(--cinder-fg);
      }
    `);
    expect(checkComponentCssSource(source, fakePath)).toEqual([]);
  });

  it('does NOT allow non-cinder data-* attribute anchors', () => {
    const source = layered(`[data-state='current'] { color: red; }`);
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toContain('data-state');
  });

  it('allows @keyframes stops like from/to/0%/100%', () => {
    const source = layered(`
      @keyframes cinder-spin {
        from { transform: rotate(0); }
        50% { transform: rotate(180deg); }
        to { transform: rotate(360deg); }
      }
      .cinder-spinner { animation: cinder-spin 1s linear infinite; }
    `);
    expect(checkComponentCssSource(source, fakePath)).toEqual([]);
  });

  it('flags root selectors inside @media just like at the top level', () => {
    const source = layered(`
      @media (min-width: 640px) {
        :root { --cinder-foo: 1; }
      }
    `);
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe(':root');
  });
});
