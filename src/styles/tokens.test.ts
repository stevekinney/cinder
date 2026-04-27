/**
 * Validates token naming conventions across all per-component token CSS files.
 *
 * Every custom property in src/styles/tokens/<name>.css must use the prefix
 * --cinder-<name>-* (public) or --_cinder-<name>-* (private).
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

const TOKENS_DIR = join(import.meta.dir, 'tokens');

describe('token naming conventions', () => {
  test('per-component token files follow --cinder-<name>-* naming', async () => {
    let files: string[];
    try {
      files = await readdir(TOKENS_DIR);
    } catch {
      // No token files yet — that's fine.
      return;
    }

    const cssFiles = files.filter((f) => f.endsWith('.css') && f !== '.gitkeep');
    if (cssFiles.length === 0) return;

    const errors: string[] = [];

    for (const file of cssFiles) {
      const componentName = file.replace(/\.css$/, '');
      const source = await readFile(join(TOKENS_DIR, file), 'utf-8');

      // Find all custom property declarations.
      const declarations = [...source.matchAll(/--([a-zA-Z0-9_-]+)\s*:/g)];

      for (const match of declarations) {
        const fullName = `--${match[1]}`;

        const isPublic = fullName.startsWith(`--cinder-${componentName}-`);
        const isPrivate = fullName.startsWith(`--_cinder-${componentName}-`);

        if (!isPublic && !isPrivate) {
          errors.push(
            `${file}: "${fullName}" must be prefixed --cinder-${componentName}-* or --_cinder-${componentName}-*`,
          );
        }
      }
    }

    expect(errors).toEqual([]);
  });
});
