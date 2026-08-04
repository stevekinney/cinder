import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parse } from 'postcss';

import {
  checkComponentCssSource,
  COMPONENT_LAYER_NAME,
  formatViolation,
  isSingleComponentLayer,
  LAYER_ORDER_PRELUDE,
} from './check-component-css.ts';

const fakePath = '/virtual/test/component.css';

/**
 * Wrap a fragment of component CSS in a complete, valid sidecar: the
 * `@layer` order-declaration prelude as line 1, then the required
 * `@layer cinder.components { … }` wrapper. Both are now intrinsic to every
 * sidecar, so a valid fixture must carry both.
 */
function layered(inner: string): string {
  return `${LAYER_ORDER_PRELUDE}\n@layer cinder.components {\n${inner}\n}`;
}

/**
 * Wrap a fragment in the component-layer block only, WITHOUT the order prelude.
 * Used by the prelude-requirement tests, where the missing prelude is the
 * point.
 */
function layeredWithoutPrelude(inner: string): string {
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

  it('allows leading comments before the order prelude', () => {
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
    const source = `${LAYER_ORDER_PRELUDE}\n.cinder-button { color: red; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations).toHaveLength(1);
    expect(violations[0]?.message).toContain('@layer cinder.components');
  });

  it('rejects a wrapper with the wrong layer name', () => {
    const source = `${LAYER_ORDER_PRELUDE}\n@layer components { .cinder-button { color: red; } }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations.some((v) => v.message.includes('@layer cinder.components'))).toBe(true);
  });

  it('rejects rules sitting outside the layer wrapper', () => {
    const source = `${layered(`.cinder-button { color: red; }`)}\n.cinder-leaked { color: blue; }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations.length).toBeGreaterThanOrEqual(1);
    expect(violations.some((v) => v.message.includes('@layer cinder.components'))).toBe(true);
  });

  it('requires the cascade-layer order prelude as line 1', () => {
    const source = layeredWithoutPrelude(`.cinder-button { color: red; }`);
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations.some((v) => v.message.includes('order prelude'))).toBe(true);
  });

  it('rejects a sidecar where the prelude is not the first node', () => {
    const source = `@import '../tab/tab.css';\n${LAYER_ORDER_PRELUDE}\n@layer cinder.components { .cinder-tabs {} }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations.some((v) => v.message.includes('must be the FIRST line'))).toBe(true);
  });

  it('accepts the prelude before sibling-leaf imports and the wrapper', () => {
    const source = `${LAYER_ORDER_PRELUDE}\n@import '../tab/tab.css';\n@layer cinder.components { .cinder-tabs { display: flex; } }`;
    expect(checkComponentCssSource(source, fakePath)).toEqual([]);
  });

  it('rejects @import at-rules', () => {
    const source = layered(`@import './tokens.css'; .cinder-button { color: red; }`);
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations.some((v) => v.message.includes('@import'))).toBe(true);
  });

  it('allows leading sibling-leaf @import for compound-parent family aggregation', () => {
    const source = `${LAYER_ORDER_PRELUDE}\n@import '../tab/tab.css';\n@import '../tab-list/tab-list.css';\n@layer cinder.components { .cinder-tabs { display: flex; } }`;
    expect(checkComponentCssSource(source, fakePath)).toEqual([]);
  });

  it('allows leading private component imports', () => {
    const source = `${LAYER_ORDER_PRELUDE}\n@import '../_internal/section-skeleton.css';\n@layer cinder.components { .cinder-blog-section {} }`;
    expect(
      checkComponentCssSource(
        source,
        resolve(import.meta.dir, '../src/components/blog-section/blog-section.css'),
      ),
    ).toEqual([]);
  });

  it('rejects a missing private stylesheet target', () => {
    const root = mkdtempSync(join(tmpdir(), 'component-css-private-'));
    try {
      const componentDirectory = join(root, 'src/components/example');
      mkdirSync(componentDirectory, { recursive: true });
      const source = `${LAYER_ORDER_PRELUDE}\n@import '../_internal/missing.css';\n@layer cinder.components { .cinder-example {} }`;
      const violations = checkComponentCssSource(source, join(componentDirectory, 'example.css'));
      expect(violations.some((violation) => violation.message.includes('does not resolve'))).toBe(
        true,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a private stylesheet that violates the component CSS contract', () => {
    const root = mkdtempSync(join(tmpdir(), 'component-css-private-'));
    try {
      const componentDirectory = join(root, 'src/components/example');
      const internalDirectory = join(root, 'src/components/_internal');
      mkdirSync(componentDirectory, { recursive: true });
      mkdirSync(internalDirectory, { recursive: true });
      writeFileSync(
        join(internalDirectory, 'invalid.css'),
        `${LAYER_ORDER_PRELUDE}\n@layer cinder.components { body { margin: 0; } }`,
      );
      const source = `${LAYER_ORDER_PRELUDE}\n@import '../_internal/invalid.css';\n@layer cinder.components { .cinder-example {} }`;
      const violations = checkComponentCssSource(source, join(componentDirectory, 'example.css'));
      expect(violations.some((violation) => violation.selector === 'body')).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a private stylesheet that imports itself', () => {
    const root = mkdtempSync(join(tmpdir(), 'component-css-private-cycle-'));
    try {
      const componentDirectory = join(root, 'src/components/example');
      const internalDirectory = join(root, 'src/components/_internal');
      mkdirSync(componentDirectory, { recursive: true });
      mkdirSync(internalDirectory, { recursive: true });
      const privatePath = join(internalDirectory, 'self.css');
      writeFileSync(
        privatePath,
        `${LAYER_ORDER_PRELUDE}\n@import '../_internal/self.css';\n@layer cinder.components { .cinder-example-private {} }`,
      );
      const source = `${LAYER_ORDER_PRELUDE}\n@import '../_internal/self.css';\n@layer cinder.components { .cinder-example {} }`;
      const violations = checkComponentCssSource(source, join(componentDirectory, 'example.css'));
      expect(violations.some((violation) => violation.message.includes('cycle'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects private stylesheets that import each other', () => {
    const root = mkdtempSync(join(tmpdir(), 'component-css-private-cycle-'));
    try {
      const componentDirectory = join(root, 'src/components/example');
      const internalDirectory = join(root, 'src/components/_internal');
      mkdirSync(componentDirectory, { recursive: true });
      mkdirSync(internalDirectory, { recursive: true });
      writeFileSync(
        join(internalDirectory, 'first.css'),
        `${LAYER_ORDER_PRELUDE}\n@import '../_internal/second.css';\n@layer cinder.components { .cinder-example-first {} }`,
      );
      writeFileSync(
        join(internalDirectory, 'second.css'),
        `${LAYER_ORDER_PRELUDE}\n@import '../_internal/first.css';\n@layer cinder.components { .cinder-example-second {} }`,
      );
      const source = `${LAYER_ORDER_PRELUDE}\n@import '../_internal/first.css';\n@layer cinder.components { .cinder-example {} }`;
      const violations = checkComponentCssSource(source, join(componentDirectory, 'example.css'));
      expect(violations.some((violation) => violation.message.includes('cycle'))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('rejects a private import that cannot resolve from an experimental sidecar', () => {
    const source = `${LAYER_ORDER_PRELUDE}\n@import '../_internal/section-skeleton.css';\n@layer cinder.components { .cinder-experimental-section {} }`;
    const violations = checkComponentCssSource(
      source,
      '/virtual/packages/components/src/components/experimental/example/example.css',
    );

    expect(violations.some((violation) => violation.message.includes('@import'))).toBe(true);
  });

  it('rejects a nested components directory that cannot resolve a private import', () => {
    const source = `${LAYER_ORDER_PRELUDE}\n@import '../_internal/section-skeleton.css';\n@layer cinder.components { .cinder-experimental-section {} }`;
    const violations = checkComponentCssSource(
      source,
      '/virtual/packages/components/src/components/experimental/components/example/example.css',
    );

    expect(violations.some((violation) => violation.message.includes('@import'))).toBe(true);
  });

  it('rejects a non-sibling-leaf @import (mismatched dir/basename)', () => {
    const source = `${LAYER_ORDER_PRELUDE}\n@import '../tab/other.css';\n@layer cinder.components { .cinder-tabs { display: flex; } }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations.some((v) => v.message.includes('@import'))).toBe(true);
  });

  it('rejects a bare-specifier @import even when shaped like a leaf', () => {
    const source = `${LAYER_ORDER_PRELUDE}\n@import 'tab/tab.css';\n@layer cinder.components { .cinder-tabs {} }`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations.some((v) => v.message.includes('@import'))).toBe(true);
  });

  it('rejects a sibling-leaf @import that follows the layer block (CSS would ignore it)', () => {
    const source = `${layered(`.cinder-tabs {}`)}\n@import '../tab/tab.css';`;
    const violations = checkComponentCssSource(source, fakePath);
    expect(violations.some((v) => v.message.includes('must appear BEFORE'))).toBe(true);
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

describe('isSingleComponentLayer', () => {
  it('accepts the order prelude plus a single cinder.components block wrapper', () => {
    expect(isSingleComponentLayer(parse(layered(`.cinder-x { color: red; }`)))).toBe(true);
  });

  it('accepts leading comments before the prelude', () => {
    expect(
      isSingleComponentLayer(parse(`/* header */\n${layered(`.cinder-x { color: red; }`)}`)),
    ).toBe(true);
  });

  it('accepts the prelude before sibling-leaf @import statements and the wrapper', () => {
    expect(
      isSingleComponentLayer(
        parse(
          `${LAYER_ORDER_PRELUDE}\n@import '../tab/tab.css';\n@import '../tab-list/tab-list.css';\n@layer cinder.components { .cinder-tabs {} }`,
        ),
      ),
    ).toBe(true);
  });

  it('rejects a non-sibling-leaf @import outside the wrapper', () => {
    expect(
      isSingleComponentLayer(
        parse(
          `${LAYER_ORDER_PRELUDE}\n@import './tokens.css';\n@layer cinder.components { .cinder-x {} }`,
        ),
      ),
    ).toBe(false);
  });

  it('rejects a bare rule with no wrapper', () => {
    expect(isSingleComponentLayer(parse(`.cinder-x { color: red; }`))).toBe(false);
  });

  it('rejects a rule sitting outside the wrapper', () => {
    expect(isSingleComponentLayer(parse(`${layered(`.cinder-x {}`)}\n.cinder-y {}`))).toBe(false);
  });

  it('rejects the statement form `@layer cinder.components;` (no block body)', () => {
    expect(isSingleComponentLayer(parse(`@layer ${COMPONENT_LAYER_NAME};`))).toBe(false);
  });

  it('rejects a wrapper with a different layer name', () => {
    expect(isSingleComponentLayer(parse(`@layer other { .cinder-x {} }`))).toBe(false);
  });
});

describe('formatViolation', () => {
  it('renders location + message for a selector-bearing violation', () => {
    const [violation] = checkComponentCssSource(layered(`:root { color: red; }`), fakePath);
    expect(violation).toBeDefined();
    const formatted = formatViolation(violation!);
    expect(formatted).toStartWith(`${fakePath}:`);
    expect(formatted).toContain(violation!.message);
  });

  it('renders location + message for a wrapper violation (no selector)', () => {
    // A prelude-bearing fragment with no `@layer cinder.components` wrapper
    // yields exactly the wrapper violation (no selector), isolating it from the
    // missing-prelude violation.
    const violations = checkComponentCssSource(
      `${LAYER_ORDER_PRELUDE}\n.cinder-x { color: red; }`,
      fakePath,
    );
    const violation = violations.find((v) => v.message.includes(`@layer ${COMPONENT_LAYER_NAME}`));
    expect(violation).toBeDefined();
    expect(violation!.selector).toBeUndefined();
    const formatted = formatViolation(violation!);
    expect(formatted).toContain(`@layer ${COMPONENT_LAYER_NAME}`);
  });
});
