// @ts-nocheck -- migrated commentary assertions use runtime-verified fixture indexing.
import { describe, expect, test } from 'bun:test';

import { generateBlockId } from './anchoring.js';
import { extractMentions } from './comments/index.js';
import { generateMarkdownSummary } from './export/index.js';
import { createSession } from './session/index.js';

describe('@cinder/commentary package smoke test', () => {
  test('exposes the core anchoring, comment, export, and session modules', () => {
    expect(generateBlockId('paragraph', 'Hello')).toMatch(/^paragraph-[a-z0-9]+$/);
    expect(extractMentions('Hi @alice')).toEqual(['alice']);
    expect(typeof generateMarkdownSummary).toBe('function');
    expect(createSession('session-1', '2024-01-01T00:00:00.000Z').id).toBe('session-1');
  });
});
