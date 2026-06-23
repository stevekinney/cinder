/**
 * Contract tests for the snapshotMode prop on ReviewEditor.
 *
 * ReviewEditor is too heavy to mount in happy-dom (Milkdown + ProseMirror
 * internals fail in non-browser DOMs). These tests assert the contract
 * indirectly: by reading the component source and confirming the prop is
 * destructured, the data-snapshot-mode attribute is emitted, the CSS rule
 * is present, and the prop is forwarded to the inner MarkdownEditor.
 *
 * Browser-level verification of the visual effect lives in Phase 1's
 * determinism harness and Phase 3's visual-regression suite.
 */
import { describe, expect, test } from 'bun:test';

const implementationSource = await Bun.file(
  new URL('./review-editor-impl.svelte', import.meta.url).pathname,
).text();

const typesSource = await Bun.file(
  new URL('./review-editor.types.ts', import.meta.url).pathname,
).text();

describe('ReviewEditor — snapshotMode contract', () => {
  test('ReviewEditorProps declares snapshotMode as an optional boolean', () => {
    expect(typesSource).toMatch(/snapshotMode\?:\s*boolean/);
  });

  test('review-editor-impl.svelte destructures snapshotMode from $props()', () => {
    expect(implementationSource).toMatch(/snapshotMode\s*=\s*false/);
  });

  test('review-editor-impl.svelte emits data-snapshot-mode on the container', () => {
    expect(implementationSource).toMatch(/data-snapshot-mode=\{snapshotMode \|\| undefined\}/);
  });

  test('review-editor-impl.svelte scopes caret-color: transparent under [data-snapshot-mode]', () => {
    // The CSS rule must scope the override to elements bearing the attribute
    // — never apply caret-color: transparent at the global level.
    expect(implementationSource).toMatch(
      /\[data-snapshot-mode\][^{]*\{[^}]*caret-color:\s*transparent/s,
    );
  });

  test('review-editor-impl.svelte scopes user-select: none under [data-snapshot-mode]', () => {
    expect(implementationSource).toMatch(/\[data-snapshot-mode\][^{]*\{[^}]*user-select:\s*none/s);
  });

  test('review-editor-impl.svelte forwards snapshotMode to the inner MarkdownEditor', () => {
    // The forwarding pattern is `{snapshotMode}` (shorthand) on the
    // MarkdownEditor invocation. Avoid matching the destructure or the
    // attribute by requiring it to appear inside a Svelte element call.
    expect(implementationSource).toMatch(/<MarkdownEditor[^/]*\{snapshotMode\}/s);
  });

  test('snapshotMode does NOT call editor.setEditable() — the plan forbids it', () => {
    // The implementation must rely on CSS + blur only. Calling setEditable
    // from this file would mean the playground wrapper is poking at editor
    // internals, which is the explicitly forbidden recipe.
    expect(implementationSource).not.toMatch(/setEditable\s*\(\s*false\s*\)/);
  });

  test('blur-on-mount runs only when snapshotMode is truthy', () => {
    // The effect must guard on snapshotMode before touching activeElement,
    // so default behavior is unchanged when the prop is omitted/false.
    expect(implementationSource).toMatch(
      /\$effect\([^)]*\)\s*=>\s*\{[\s\S]*?if\s*\(!snapshotMode\)\s*return/,
    );
  });
});
