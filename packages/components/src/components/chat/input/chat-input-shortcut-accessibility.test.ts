/**
 * Source-contract tests for chat input shortcut accessibility (Slice 2).
 *
 * These tests read the component source rather than mounting it, because
 * ChatInput wraps MarkdownEditor (a Milkdown/ProseMirror bundle) which fights
 * happy-dom. The contract assertions are precise enough to catch regressions.
 */
import { describe, expect, test } from 'bun:test';

const chatInputSource = await Bun.file(
  new URL('./chat-input.svelte', import.meta.url).pathname,
).text();

const markdownEditorSource = await Bun.file(
  new URL('../../markdown-editor/markdown-editor.svelte', import.meta.url).pathname,
).text();

describe('ChatInput — shortcut accessibility', () => {
  test('derives a shortcut description id separate from the visible hint id', () => {
    // Must have both hintId and shortcutDescriptionId derived
    expect(chatInputSource).toMatch(/shortcutDescriptionId\s*=\s*\$derived/);
    expect(chatInputSource).toMatch(/hintId\s*=\s*\$derived/);
    // The two ids must be different (different suffix)
    expect(chatInputSource).toMatch(/shortcut-description/);
    expect(chatInputSource).toMatch(/`\$\{id\}-hint`/);
  });

  test('renders a visually hidden shortcut description element', () => {
    // Must have a span/element with shortcutDescriptionId and sr-only class
    expect(chatInputSource).toMatch(/id=\{shortcutDescriptionId\}/);
    expect(chatInputSource).toMatch(/class="sr-only"/);
    // Must mention Enter and Shift+Enter in text
    expect(chatInputSource).toMatch(/Enter/);
    expect(chatInputSource).toMatch(/Shift\+Enter/);
  });

  test('send button aria-describedby references the hidden shortcut description', () => {
    // Send button must point at shortcutDescriptionId, not hintId
    expect(chatInputSource).toMatch(/aria-describedby=\{shortcutDescriptionId\}/);
  });

  test('send button does not reference the visible hint id via aria-describedby', () => {
    // The visible hint should NOT be the aria-describedby target (it can be display:none)
    // We look for the send button context: aria-describedby={hintId} should NOT appear
    // after the shortcutDescriptionId was introduced
    expect(chatInputSource).not.toMatch(/aria-describedby=\{hintId\}/);
  });

  test('MarkdownEditor receives aria-describedby forwarding the shortcut id', () => {
    // The MarkdownEditor element must receive aria-describedby bound to shortcutDescriptionId
    expect(chatInputSource).toMatch(/aria-describedby=\{shortcutDescriptionId\}/);
  });

  test('keycap rule sets an explicit color', () => {
    // .chat-input-hint kbd must have an explicit color declaration
    expect(chatInputSource).toMatch(/\.chat-input-hint\s+kbd\s*\{[^}]*color:/s);
  });
});

describe('MarkdownEditor — aria-describedby forwarding', () => {
  test('extracts aria-describedby from $props() separately from rest', () => {
    // Must destructure 'aria-describedby' by name
    expect(markdownEditorSource).toMatch(/'aria-describedby'\s*:\s*ariaDescribedby/);
  });

  test('preserves root rest-attribute behavior by spreading ...rest on the wrapper', () => {
    // The wrapper div must still spread ...rest for other native attributes
    expect(markdownEditorSource).toMatch(/\{\.\.\.rest\}/);
  });

  test('does not put aria-describedby on the non-interactive wrapper div', () => {
    // The wrapper div has no ARIA role and is not focusable, so carrying
    // aria-describedby there is redundant with the focusable surfaces and risks
    // double-announcement. The attribute belongs only on the textarea and the
    // ProseMirror view.dom (asserted below).
    const wrapperOpenTag = markdownEditorSource.match(
      /<div\s+bind:this=\{wrapperElement\}[\s\S]*?>/,
    );
    expect(wrapperOpenTag).not.toBeNull();
    expect(wrapperOpenTag?.[0]).not.toMatch(/aria-describedby/);
  });

  test('applies aria-describedby to the source textarea', () => {
    // The textarea in source mode must receive aria-describedby
    expect(markdownEditorSource).toMatch(/<textarea[\s\S]*?aria-describedby=\{ariaDescribedby\}/);
  });

  test('applies aria-describedby to ProseMirror view.dom in WYSIWYG mode', () => {
    // Must have an effect that sets aria-describedby on view.dom
    expect(markdownEditorSource).toMatch(/view\.dom/);
    expect(markdownEditorSource).toMatch(/setAttribute\s*\(\s*['"]aria-describedby['"]/);
    expect(markdownEditorSource).toMatch(/removeAttribute\s*\(\s*['"]aria-describedby['"]/);
  });

  test('removes aria-describedby from view.dom when prop is undefined', () => {
    // Must call removeAttribute when ariaDescribedby is falsy
    expect(markdownEditorSource).toMatch(/removeAttribute\s*\(\s*['"]aria-describedby['"]\s*\)/);
  });
});
