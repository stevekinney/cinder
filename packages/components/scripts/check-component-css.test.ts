import { describe, expect, it } from 'bun:test';

import { checkComponentCssSource } from './check-component-css.ts';

const fakePath = '/virtual/test/component.css';

describe('checkComponentCssSource', () => {
  it('passes a well-scoped component sidecar', () => {
    const source = `
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
    `;
    expect(checkComponentCssSource(source, fakePath)).toEqual([]);
  });

  it('allows scoped descendants of forbidden tags', () => {
    const source = `
      .cinder-button > * { margin-inline-end: 0; }
      .cinder-banner :where(html) { color: inherit; }
    `;
    expect(checkComponentCssSource(source, fakePath)).toEqual([]);
  });

  it('allows class lists nested inside functional pseudos', () => {
    const source = `
      :is(.cinder-button, .cinder-button-group) { color: red; }
      :where(.cinder-card) { padding: 1rem; }
      :not(.cinder-button-icon).cinder-button { font-weight: 600; }
    `;
    expect(checkComponentCssSource(source, fakePath)).toEqual([]);
  });

  it('rejects :root at the top level', () => {
    const source = `:root { --cinder-color-fg: black; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe(':root');
  });

  it('rejects :where(:root) — globals hidden inside a functional pseudo', () => {
    const source = `:where(:root) { --cinder-color-fg: black; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe(':where(:root)');
  });

  it('rejects :is(html, body)', () => {
    const source = `:is(html, body) { font-family: sans-serif; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe(':is(html, body)');
  });

  it('rejects html and body selectors', () => {
    const source = `html { font-size: 16px; } body { margin: 0; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.selector)).toEqual(['html', 'body']);
  });

  it('rejects raw tag selectors with no class anchor', () => {
    const source = `button { all: unset; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe('button');
  });

  it('rejects bare universal selectors', () => {
    const source = `* { box-sizing: border-box; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe('*');
  });

  it('rejects universal + pseudo at the top level', () => {
    const source = `*:focus { outline: 2px solid blue; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe('*:focus');
  });

  it('rejects bare attribute selectors at the top level', () => {
    const source = `[data-theme='dark'] { background: black; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toContain('data-theme');
  });

  it('rejects @layer at-rules', () => {
    const source = `@layer components { .cinder-button { color: red; } }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0]?.message).toContain('@layer');
  });

  it('rejects @import at-rules', () => {
    const source = `@import './tokens.css'; .cinder-button { color: red; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain('@import');
  });

  it('handles selector lists', () => {
    const source = `.cinder-button, :root { color: red; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe(':root');
  });

  it('allows data-cinder-* attribute anchors (state-driven scoping)', () => {
    const source = `
      [data-cinder-state='current'] .cinder-steps__marker {
        background: var(--cinder-steps-current-bg);
      }
      [data-cinder-variant='primary'] {
        color: var(--cinder-fg);
      }
    `;
    expect(checkComponentCssSource(source, fakePath)).toEqual([]);
  });

  it('does NOT allow non-cinder data-* attribute anchors', () => {
    const source = `[data-state='current'] { color: red; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toContain('data-state');
  });

  it('allows @keyframes stops like from/to/0%/100%', () => {
    const source = `
      @keyframes cinder-spin {
        from { transform: rotate(0); }
        50% { transform: rotate(180deg); }
        to { transform: rotate(360deg); }
      }
      .cinder-spinner { animation: cinder-spin 1s linear infinite; }
    `;
    expect(checkComponentCssSource(source, fakePath)).toEqual([]);
  });

  it('flags root selectors inside @media just like at the top level', () => {
    const source = `
      @media (min-width: 640px) {
        :root { --cinder-foo: 1; }
      }
    `;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe(':root');
  });
});
