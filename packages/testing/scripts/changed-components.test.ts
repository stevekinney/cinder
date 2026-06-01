import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decide } from './changed-components.ts';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(scriptDirectory, '..', '..', '..');

const C = 'packages/components/src/components';
const U = 'packages/components/src/utilities';

/**
 * A small synthetic source tree exercising the dependents graph without the
 * filesystem:
 *   button  ← dialog ← confirm
 *   badge   (leaf)
 *   class-names.ts ← button, badge
 */
const sourceFiles = new Map<string, string>([
  [`${C}/button/button.svelte`, `import { cx } from '../../utilities/class-names.ts';`],
  [`${C}/dialog/dialog.svelte`, `import Button from '../button/button.svelte';`],
  [`${C}/confirm/confirm.svelte`, `import Dialog from '../dialog/dialog.svelte';`],
  [`${C}/badge/badge.svelte`, `import { cx } from '../../utilities/class-names.ts';`],
  [`${U}/class-names.ts`, `export const cx = () => '';`],
]);
const knownSlugs = new Set(['button', 'dialog', 'confirm', 'badge', 'accordion']);

describe('changed-components decide()', () => {
  it('filters to a single component when nothing depends on it', () => {
    const result = decide([`${C}/badge/badge.svelte`], sourceFiles, knownSlugs);
    expect(result).toEqual({ mode: 'filtered', components: ['badge'] });
  });

  it('includes transitive dependents of a changed component', () => {
    const result = decide([`${C}/button/button.svelte`], sourceFiles, knownSlugs);
    expect(result).toEqual({ mode: 'filtered', components: ['button', 'confirm', 'dialog'] });
  });

  it('fans a shared utility out to every dependent', () => {
    const result = decide([`${U}/class-names.ts`], sourceFiles, knownSlugs);
    expect(result).toEqual({
      mode: 'filtered',
      components: ['badge', 'button', 'confirm', 'dialog'],
    });
  });

  it('maps a playground example change to its slug', () => {
    const result = decide(
      ['packages/playground/src/examples/accordion/basic.example.svelte'],
      sourceFiles,
      knownSlugs,
    );
    expect(result).toEqual({ mode: 'filtered', components: ['accordion'] });
  });

  it('merges example slugs with component-source slugs', () => {
    const result = decide(
      [`${C}/badge/badge.svelte`, 'packages/playground/src/examples/accordion/x.example.svelte'],
      sourceFiles,
      knownSlugs,
    );
    expect(result).toEqual({ mode: 'filtered', components: ['accordion', 'badge'] });
  });

  it('forces full for an example of an unknown slug', () => {
    const result = decide(
      ['packages/playground/src/examples/ghost/x.example.svelte'],
      sourceFiles,
      knownSlugs,
    );
    expect(result.mode).toBe('full');
  });

  it('forces full when a testing-harness file is touched', () => {
    const result = decide(
      [`${C}/button/button.svelte`, 'packages/testing/playwright.config.ts'],
      sourceFiles,
      knownSlugs,
    );
    expect(result.mode).toBe('full');
  });

  it('forces full for the lockfile and root manifest', () => {
    expect(decide(['bun.lock'], sourceFiles, knownSlugs).mode).toBe('full');
    expect(decide(['package.json'], sourceFiles, knownSlugs).mode).toBe('full');
  });

  it('forces full for global style changes', () => {
    const result = decide(['packages/components/src/styles/tokens.css'], sourceFiles, knownSlugs);
    expect(result.mode).toBe('full');
  });

  it('forces full when a changed file was deleted', () => {
    const result = decide([`${C}/button/button.svelte`], sourceFiles, knownSlugs, [
      `${C}/old/old.svelte`,
    ]);
    expect(result.mode).toBe('full');
  });

  it('ignores blank lines in the changed-file list', () => {
    const result = decide(['', `${C}/badge/badge.svelte`, '  '], sourceFiles, knownSlugs);
    expect(result).toEqual({ mode: 'filtered', components: ['badge'] });
  });

  it('forces full when an example is co-changed with a real force-full trigger', () => {
    // The example slug must NOT rescue a genuine force-full (e.g. lockfile). This
    // pins the string-match branch in decide() that distinguishes "no component
    // changes" (example wins) from a real force-full reason (full wins).
    const result = decide(
      ['packages/playground/src/examples/accordion/basic.example.svelte', 'bun.lock'],
      sourceFiles,
      knownSlugs,
    );
    expect(result.mode).toBe('full');
  });

  it('filters to the example slug when the only co-change is an ignorable doc', () => {
    const result = decide(
      [
        'packages/playground/src/examples/accordion/basic.example.svelte',
        'packages/playground/README.md',
      ],
      sourceFiles,
      knownSlugs,
    );
    expect(result).toEqual({ mode: 'filtered', components: ['accordion'] });
  });
});

// ---------------------------------------------------------------------------
// Integration: run the ACTUAL CLI from the repo root, exactly as CI does.
// ---------------------------------------------------------------------------

describe('changed-components CLI (integration, real tree)', () => {
  function runCli(changedPaths: string[]): { mode: string; components: string } {
    const result = spawnSync('bun', ['run', 'packages/testing/scripts/changed-components.ts'], {
      cwd: workspaceRoot,
      input: changedPaths.join('\n') + '\n',
      encoding: 'utf-8',
      env: { ...process.env, GITHUB_OUTPUT: '' },
    });
    expect(result.status).toBe(0);
    const stdout = result.stdout ?? '';
    const mode = /mode=(\w+)/.exec(stdout)?.[1] ?? '';
    const components = /components=([^\n]*)/.exec(stdout)?.[1] ?? '';
    return { mode, components };
  }

  it('a real button change is filtered to button + real dependents', () => {
    const { mode, components } = runCli([
      'packages/components/src/components/button/button.svelte',
    ]);
    expect(mode).toBe('filtered');
    const slugs = components.split(',');
    expect(slugs).toContain('button');
    expect(slugs).toContain('confirm-dialog');
    expect(slugs).toContain('alert-dialog');
  });

  it('the lockfile forces full', () => {
    expect(runCli(['bun.lock'])).toEqual({ mode: 'full', components: '' });
  });

  it('a real example change is filtered to its slug', () => {
    const { mode, components } = runCli([
      'packages/playground/src/examples/accordion/basic.example.svelte',
    ]);
    expect(mode).toBe('filtered');
    expect(components.split(',')).toContain('accordion');
  });
});
