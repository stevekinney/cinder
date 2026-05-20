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
      .cinder-card body { /* still scoped under .cinder-card */ }
    `;
    expect(checkComponentCssSource(source, fakePath)).toEqual([]);
  });

  it('rejects :root at the top level', () => {
    const source = `:root { --cinder-color-fg: black; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe(':root');
    expect(violations[0]?.message).toContain(':root');
  });

  it('rejects html and body selectors', () => {
    const source = `html { font-size: 16px; } body { margin: 0; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.selector)).toEqual(['html', 'body']);
  });

  it('rejects bare universal selectors', () => {
    const source = `* { box-sizing: border-box; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe('*');
  });

  it('rejects @layer at-rules', () => {
    const source = `@layer components { .cinder-button { color: red; } }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations[0]?.message).toContain('@layer');
  });

  it('handles selector lists', () => {
    const source = `.cinder-button, :root { color: red; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.selector).toBe(':root');
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
