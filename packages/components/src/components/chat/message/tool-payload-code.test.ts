/**
 * Source-contract regression for the chat tool-payload code block.
 *
 * When `<CinderProvider>` was removed, `tool-payload-code.svelte` had to keep
 * its scoped, `depict`-themed JSON highlighter rather than silently falling
 * through to `<CodeBlock>`'s bundled auto-load default (which would change the
 * JSON theme and Shiki load timing). This test pins that contract: the
 * tool-payload passes its own `highlightJson` highlighter explicitly and does
 * not route through the default.
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
  test('passes its own explicit highlighter to CodeBlock (not the bundled default)', () => {
    expect(source).toContain('highlighter={highlightJson}');
    expect(source).toMatch(/<CodeBlock[^>]*highlighter=\{highlightJson\}/);
  });

  test("highlightJson uses Shiki's depict theme", () => {
    expect(source).toContain("theme: 'depict'");
  });

  test('does not reintroduce a CinderProvider wrapper', () => {
    expect(source).not.toContain('CinderProvider');
    expect(source).not.toContain('cinder-provider');
  });

  test('the CodeBlock is labelled as json', () => {
    expect(source).toContain('language="json"');
  });
});
