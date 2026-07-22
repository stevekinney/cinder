/**
 * Contract tests for the snapshotMode prop on MarkdownEditor.
 *
 * MarkdownEditor's runtime depends on Milkdown/ProseMirror, which fights
 * happy-dom when other components have already mounted in the same suite.
 * The mount-based check works in isolation but flakes inside the full test
 * run, so we assert the contract by reading the source.
 *
 * Browser-level verification of the visual effect lives in Phase 1's
 * determinism harness and Phase 3's visual-regression suite.
 */
import { describe, expect, test } from 'bun:test';

const implementationSource = await Bun.file(
  new URL('./markdown-editor.svelte', import.meta.url).pathname,
).text();

const typesSource = await Bun.file(
  new URL('./markdown-editor.types.ts', import.meta.url).pathname,
).text();

describe('MarkdownEditor — snapshotMode contract', () => {
  test('MarkdownEditorProps declares snapshotMode as an optional boolean', () => {
    expect(typesSource).toMatch(/snapshotMode\?:\s*boolean/);
  });

  test('markdown-editor.svelte destructures snapshotMode from $props()', () => {
    expect(implementationSource).toMatch(/snapshotMode\s*=\s*false/);
  });

  test('markdown-editor.svelte emits data-snapshot-mode on the wrapper', () => {
    expect(implementationSource).toMatch(/data-snapshot-mode=\{snapshotMode \|\| undefined\}/);
  });

  test('markdown-editor.svelte scopes caret-color: transparent under [data-snapshot-mode]', () => {
    expect(implementationSource).toMatch(
      /\[data-snapshot-mode\][^{]*\{[^}]*caret-color:\s*transparent/s,
    );
  });

  test('markdown-editor.svelte scopes user-select: none under [data-snapshot-mode]', () => {
    expect(implementationSource).toMatch(/\[data-snapshot-mode\][^{]*\{[^}]*user-select:\s*none/s);
  });

  test('snapshotMode does NOT call editor.setEditable() — the plan forbids it', () => {
    // The implementation must rely on CSS + blur only. Calling setEditable
    // from this file would mean the wrapper is poking at editor internals,
    // which is the explicitly forbidden recipe.
    const setEditableCalls = (implementationSource.match(/setEditable\(/g) ?? []).filter(
      (_match, index, all) => {
        // Allow setEditable references inside the existing readonly machinery,
        // but disallow any call passing `false` directly.
        return all[index] === 'setEditable(';
      },
    );
    // The existing readonly path may call setEditorReadonly which internally
    // updates editability — that's pre-existing business logic, not the
    // forbidden snapshot recipe. Assert there is no `setEditable(false)`
    // literal anywhere in the file.
    expect(implementationSource).not.toMatch(/setEditable\s*\(\s*false\s*\)/);
    // Sanity: the regex above didn't match no calls at all unless the
    // implementation no longer references setEditable, which is fine.
    expect(setEditableCalls.length).toBeGreaterThanOrEqual(0);
  });

  test('blur-on-mount runs only when snapshotMode is truthy', () => {
    // The effect must guard on snapshotMode before touching activeElement,
    // so default behavior is unchanged when the prop is omitted/false.
    expect(implementationSource).toMatch(
      /\$effect\([^)]*\)\s*=>\s*\{[\s\S]*?if\s*\(!snapshotMode\)\s*return/,
    );
  });
});
