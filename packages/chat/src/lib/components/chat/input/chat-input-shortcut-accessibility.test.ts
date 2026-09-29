/**
 * Source-contract tests for chat input shortcut accessibility (Slice 2).
 */
import { describe, expect, test } from 'bun:test';

const chatInputSource = await Bun.file(
  new URL('./chat-input.svelte', import.meta.url).pathname,
).text();

describe('ChatInput — shortcut accessibility', () => {
  test('does not import the rich MarkdownEditor composer', () => {
    expect(chatInputSource).not.toContain('MarkdownEditor');
    expect(chatInputSource).not.toContain('../../markdown-editor/markdown-editor.svelte');
  });

  test('derives a shortcut description id without a permanent visual hint', () => {
    expect(chatInputSource).toMatch(/shortcutDescriptionId\s*=\s*\$derived/);
    expect(chatInputSource).toMatch(/shortcut-description/);
    expect(chatInputSource).not.toContain('chat-input-hint');
  });

  test('renders a visually hidden shortcut description element', () => {
    // Must have a span/element with shortcutDescriptionId and the cinder-sr-only class
    expect(chatInputSource).toMatch(/id=\{shortcutDescriptionId\}/);
    expect(chatInputSource).toMatch(/class="cinder-sr-only"/);
    // Must mention Enter and Shift+Enter in text
    expect(chatInputSource).toMatch(/Enter/);
    expect(chatInputSource).toMatch(/Shift\+Enter/);
  });

  test('send button aria-describedby references the hidden shortcut description', () => {
    // Send button must point at shortcutDescriptionId, not hintId
    expect(chatInputSource).toMatch(/aria-describedby=\{shortcutDescriptionId\}/);
  });

  test('stop button aria-describedby references the hidden streaming shortcut description', () => {
    const stopButtonMatch = chatInputSource.match(/data-stop[\s\S]*?<\/button>/);
    expect(stopButtonMatch?.[0]).toMatch(/aria-describedby=\{shortcutDescriptionId\}/);
  });

  test('send button does not reference the visible hint id via aria-describedby', () => {
    // The visible hint should NOT be the aria-describedby target (it can be display:none)
    // We look for the send button context: aria-describedby={hintId} should NOT appear
    // after the shortcutDescriptionId was introduced
    expect(chatInputSource).not.toMatch(/aria-describedby=\{hintId\}/);
  });

  test('textarea composer receives label and shortcut description', () => {
    const textareaMatch = chatInputSource.match(/<textarea[\s\S]*?<\/textarea>/);
    expect(textareaMatch).not.toBeNull();
    expect(textareaMatch?.[0]).toMatch(/aria-label=\{resolvedComposerLabel\}/);
    expect(textareaMatch?.[0]).toMatch(/aria-describedby=\{shortcutDescriptionId\}/);
  });

  test('uses Cinder Tooltip for contextual send guidance', () => {
    expect(chatInputSource).toContain('import { ArrowUp, Paperclip, Square, Tooltip, X, Button }');
    expect(chatInputSource).toContain("'Wait for attachments'");
    expect(chatInputSource).toContain("'Add a message or attachment'");
    expect(chatInputSource).toContain("'Stop generating'");
    expect(chatInputSource).toContain("'Send (Command or Control + Enter)'");
    expect(chatInputSource).toContain("'Send message'");
    expect(chatInputSource).toContain("'Send (Enter)'");
  });
});
