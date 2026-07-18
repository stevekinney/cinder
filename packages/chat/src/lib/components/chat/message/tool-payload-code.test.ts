/**
 * Source-contract regression for the chat tool-payload code block.
 *
 * Chat's server bundle must not import the rich markdown renderer just to make
 * tool payload JSON readable. `CodeBlock` owns the lazy highlighter boundary,
 * so the tool payload should delegate to it without its own markdown-rendering
 * import or explicit highlighter.
 *
 * `ChatMessage`/tool-payload are too heavy to mount usefully in happy-dom for
 * this concern, so we assert against the component source text (matching the
 * sibling `chat-message-action-buttons.test.ts` convention).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, test } from 'bun:test';

const source = readFileSync(resolve(import.meta.dir, 'tool-payload-code.svelte'), 'utf8');

describe('chat tool-payload code block', () => {
  test('delegates highlighting to CodeBlock without a tool-local highlighter', () => {
    expect(source).toContain('<CodeBlock {code} language="json" />');
    expect(source).not.toContain('highlighter={highlightJson}');
    expect(source).not.toContain('function highlightJson');
  });

  test('does not import the rich markdown rendering pipeline', () => {
    expect(source).not.toContain('@lostgradient/cinder/markdown/rendering');
    expect(source).not.toContain('@cinder/markdown/rendering');
  });

  test('does not reintroduce a CinderProvider wrapper', () => {
    expect(source).not.toContain('CinderProvider');
    expect(source).not.toContain('cinder-provider');
  });

  test('the CodeBlock is labelled as json', () => {
    expect(source).toContain('language="json"');
  });
});
