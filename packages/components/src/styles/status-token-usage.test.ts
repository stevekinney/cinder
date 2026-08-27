import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

const COMPONENTS_DIR = join(import.meta.dir, '..', 'components');
const STYLES_DIR = join(import.meta.dir, 'components');

// diff-viewer and review-editor moved to @lostgradient/editor (see
// docs/decisions/package-boundaries.md); their audit entries moved with them
// and are no longer part of this package's source tree.
const auditedFiles = [
  join(COMPONENTS_DIR, 'badge', 'badge.css'),
  join(COMPONENTS_DIR, 'button', 'button.css'),
  join(COMPONENTS_DIR, 'chip', 'chip.css'),
  join(COMPONENTS_DIR, 'dropdown', 'dropdown.css'),
  join(STYLES_DIR, 'json-highlight.css'),
];

const forbiddenStatusMixPattern =
  /color-mix\((?:(?!;).|\r|\n)*?var\(\s*--cinder-(info|success|warning|danger)\s*(?:[,)\s])/m;

function declarationValue(source: string, token: string): string {
  const match = source.match(new RegExp(`${token}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`Missing ${token} declaration`);
  return match[1];
}

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

    // Accent lives under its own domain rather than `status.*`: it is a brand
    // colour, not a status, and CIN-33 kept that distinction in the names.
    const soft = (variant: string) =>
      variant === 'accent' ? '--cinder-accent' : `--cinder-status-${variant}`;

    for (const status of ['neutral', 'accent', 'success', 'warning', 'danger', 'info']) {
      expect(badgeSource).toContain(`var(${soft(status)}-background)`);
      expect(badgeSource).toContain(`var(${soft(status)}-text)`);
      expect(badgeSource).toContain(`var(${soft(status)}-border)`);

      expect(chipSource).toContain(`var(${soft(status)}-background)`);
      expect(chipSource).toContain(`var(${soft(status)}-text)`);
      expect(chipSource).toContain(`var(${soft(status)}-border)`);
    }
  });

  test('derived status tiers retain the polarity-aware relative-color formula', async () => {
    const tokens = await readFile(join(import.meta.dir, 'tokens-base.css'), 'utf-8');
    for (const status of ['info', 'success', 'warning', 'danger']) {
      const muted = declarationValue(tokens, `--cinder-status-${status}-muted`);
      const subtle = declarationValue(tokens, `--cinder-status-${status}-subtle`);
      expect(muted).toContain(`var(--cinder-status-${status}-solid)`);
      expect(muted).toContain('var(--cinder-surface)');
      expect(muted).toContain('36%');
      expect(subtle).toContain(`var(--cinder-status-${status}-solid)`);
      expect(subtle).toContain('var(--cinder-text-default)');
      expect(subtle).toContain('36%');
    }
  });
});
