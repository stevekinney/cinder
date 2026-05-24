import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

const COMPONENTS_DIR = join(import.meta.dir, '..', 'components');
const STYLES_DIR = join(import.meta.dir, 'components');

const auditedFiles = [
  join(COMPONENTS_DIR, 'badge', 'badge.css'),
  join(COMPONENTS_DIR, 'button', 'button.css'),
  join(COMPONENTS_DIR, 'chat', 'input', 'chat-input.svelte'),
  join(COMPONENTS_DIR, 'chat', 'message', 'chat-message.svelte'),
  join(COMPONENTS_DIR, 'chat', 'message', 'tool-call-group.svelte'),
  join(COMPONENTS_DIR, 'chip', 'chip.css'),
  join(COMPONENTS_DIR, 'diff-viewer', 'diff-line.svelte'),
  join(COMPONENTS_DIR, 'diff-viewer', 'diff-viewer.svelte'),
  join(COMPONENTS_DIR, 'dropdown', 'dropdown.css'),
  join(COMPONENTS_DIR, 'review-editor', 'comment-list.svelte'),
  join(COMPONENTS_DIR, 'review-editor', 'comment-sidebar.svelte'),
  join(STYLES_DIR, 'json-highlight.css'),
];

const forbiddenStatusMixPattern =
  /color-mix\((?:(?!;).|\r|\n)*?var\(\s*--cinder-(info|success|warning|danger)\s*(?:[,)\s])/m;

describe('status token usage', () => {
  test('audited files do not mix solid status tokens into soft surfaces', async () => {
    const failures: string[] = [];

    for (const file of auditedFiles) {
      const source = await readFile(file, 'utf-8');

      if (forbiddenStatusMixPattern.test(source)) {
        failures.push(file);
      }
    }

    expect(failures).toEqual([]);
  });

  test('badge and chip variants use semantic status triples directly', async () => {
    const badgeSource = await readFile(join(COMPONENTS_DIR, 'badge', 'badge.css'), 'utf-8');
    const chipSource = await readFile(join(COMPONENTS_DIR, 'chip', 'chip.css'), 'utf-8');

    for (const status of ['success', 'warning', 'danger', 'info']) {
      expect(badgeSource).toContain(`var(--cinder-color-${status}-bg)`);
      expect(badgeSource).toContain(`var(--cinder-color-${status}-fg)`);
      expect(badgeSource).toContain(`var(--cinder-color-${status}-border)`);

      expect(chipSource).toContain(`var(--cinder-color-${status}-bg)`);
      expect(chipSource).toContain(`var(--cinder-color-${status}-fg)`);
      expect(chipSource).toContain(`var(--cinder-color-${status}-border)`);
    }
  });
});
