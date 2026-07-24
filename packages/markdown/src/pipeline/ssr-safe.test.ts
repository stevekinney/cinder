/**
 * @lostgradient/markdown/pipeline barrel is SSR-safe (Bun no-DOM smoke)
 *
 * Verifies that every runtime export of the pipeline barrel can be imported
 * and called in a Node-like environment with no DOM present. Milkdown and
 * ProseMirror touch browser globals at module-evaluation time, but the
 * pipeline (remark/unified/mdast) is purely computational — this test
 * confirms that invariant stays true.
 *
 * Caveat: Bun no-DOM success ≠ the production SSR bundler environment.
 * A production bundler may resolve conditional exports differently, and this
 * test cannot catch that. If the repo grows an SSR compile path (e.g. a
 * SvelteKit fixture that exercises the full bundle), prefer it; otherwise this
 * smoke test documents and guards the invariant.
 */

import { describe, expect, it } from 'bun:test';

// Delete browser globals before importing so any accidental DOM access throws.
const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

Reflect.deleteProperty(globalThis, 'document');
Reflect.deleteProperty(globalThis, 'window');

// Dynamic import after removing globals to ensure module init is clean.
const pipeline = await import('./index.js');

// Restore globals so other test files in the suite aren't affected.
if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);

describe('@lostgradient/markdown/pipeline barrel is SSR-safe (Bun no-DOM smoke)', () => {
  it('exports parse as a function', () => {
    expect(typeof pipeline.parse).toBe('function');
  });

  it('exports parseOrThrow as a function', () => {
    expect(typeof pipeline.parseOrThrow).toBe('function');
  });

  it('exports serialize as a function', () => {
    expect(typeof pipeline.serialize).toBe('function');
  });

  it('exports roundTrip as a function', () => {
    expect(typeof pipeline.roundTrip).toBe('function');
  });

  it('exports normalize as a function', () => {
    expect(typeof pipeline.normalize).toBe('function');
  });

  it('exports astEquals as a function', () => {
    expect(typeof pipeline.astEquals).toBe('function');
  });

  it('exports extractFrontMatter as a function', () => {
    expect(typeof pipeline.extractFrontMatter).toBe('function');
  });

  it('parse runs without DOM globals', () => {
    const result = pipeline.parse('# Hello *world*');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.ast.type).toBe('root');
    }
  });

  it('serialize runs without DOM globals', () => {
    const ast = pipeline.parseOrThrow('# Hello');
    const output = pipeline.serialize(ast);
    expect(output).toContain('Hello');
  });

  it('roundTrip runs without DOM globals', () => {
    const result = pipeline.roundTrip('# Hello\n\nParagraph text.\n');
    expect(result.passes).toBe(true);
  });

  it('normalize runs without DOM globals', () => {
    const output = pipeline.normalize('# Hello\n\nsome text\n');
    expect(typeof output).toBe('string');
  });
});
