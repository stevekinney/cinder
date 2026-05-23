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
const TOKENS_BASE_PATH = join(import.meta.dir, 'tokens-base.css');

function extractRootBlock(css: string): string {
  const rootMatch = css.match(/^\s*:root\s*\{([\s\S]*?)\n\}/m);

  if (!rootMatch?.[1]) {
    throw new Error('Could not find :root { ... } block in tokens-base.css');
  }

  return rootMatch[1];
}

function extractReducedMotionRootBlock(css: string): string {
  const reducedMotionMatch = css.match(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*:root\s*\{([\s\S]*?)\n\s*\}\s*\}/m,
  );

  if (!reducedMotionMatch?.[1]) {
    throw new Error('Could not find reduced-motion :root block in tokens-base.css');
  }

  return reducedMotionMatch[1];
}

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

describe('global motion tokens', () => {
  test('tokens-base.css declares dedicated repeating animation duration tokens', async () => {
    const css = await readFile(TOKENS_BASE_PATH, 'utf-8');
    const rootBlock = extractRootBlock(css);

    expect(rootBlock).toContain('--cinder-duration-spin: 750ms;');
    expect(rootBlock).toContain('--cinder-duration-progress-bar-indeterminate: 1.6s;');
    expect(rootBlock).toContain('--cinder-duration-progress-ring-spin: 1.4s;');
  });

  test('repeating animation duration tokens collapse to 0ms under prefers-reduced-motion', async () => {
    const css = await readFile(TOKENS_BASE_PATH, 'utf-8');
    const reducedMotionRootBlock = extractReducedMotionRootBlock(css);

    expect(reducedMotionRootBlock).toContain('--cinder-duration-spin: 0ms;');
    expect(reducedMotionRootBlock).toContain('--cinder-duration-progress-bar-indeterminate: 0ms;');
    expect(reducedMotionRootBlock).toContain('--cinder-duration-progress-ring-spin: 0ms;');
  });
});
