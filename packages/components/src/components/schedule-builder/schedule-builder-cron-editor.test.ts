import { describe, expect, test } from 'bun:test';

import { cronExpressionForEditor, type CronEditor } from './schedule-builder-cron-editor.ts';

describe('cronExpressionForEditor', () => {
  test('falls back to an empty string for a mode with no direct expression form', () => {
    const editor: CronEditor = { mode: 'advanced', value: 0, start: 0, end: 0, step: 1 };
    expect(cronExpressionForEditor(editor)).toBe('');
  });
});
