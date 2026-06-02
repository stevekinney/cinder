import { describe, expect, it } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decide, decideExplicitComponents } from './changed-components.ts';

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

describe('changed-components compose-only leaves', () => {
  // `feed-event` is a compose-only leaf (no standalone Playwright page); `feed`
  // renders it. The scope job must never EMIT `feed-event` (the runner rejects
  // unknown slugs) — a change to it should map to `feed` through the closure.
  const feedTree = new Map<string, string>([
    [`${C}/feed/feed.svelte`, `import FeedEvent from '../feed-event/feed-event.svelte';`],
    [`${C}/feed-event/feed-event.svelte`, `export const x = 1;`],
  ]);
  const feedKnownSlugs = new Set(['feed', 'feed-event']);
  const composeOnly = new Set(['feed-event']);

  it('maps a compose-only leaf change to its parent slug, never emitting the leaf', () => {
    const result = decide(
      [`${C}/feed-event/feed-event.svelte`],
      feedTree,
      feedKnownSlugs,
      [],
      composeOnly,
    );
    expect(result).toEqual({ mode: 'filtered', components: ['feed'] });
  });

  it('maps a compose-only SIDECAR change (not a graph node) to its parent via the canonical entry', () => {
    // `feed-event.test.ts` is a component-tree sidecar that is NOT in the graph
    // (sourceFiles). Reachability must seed from the canonical feed-event.svelte
    // entry, not the sidecar path — otherwise the closure is empty and it wrongly
    // forces full. This is the exact case the reachability guard regressed on.
    const result = decide(
      [`${C}/feed-event/feed-event.test.ts`],
      feedTree,
      feedKnownSlugs,
      [],
      composeOnly,
    );
    expect(result).toEqual({ mode: 'filtered', components: ['feed'] });
  });

  it('forces full when a compose-only leaf reaches no standalone parent (orphaned)', () => {
    // No parent imports the leaf — it cannot map to a testable slug, so emitting
    // it would crash the runner and emitting nothing would silently skip it.
    const orphanTree = new Map<string, string>([
      [`${C}/feed-event/feed-event.svelte`, `export const x = 1;`],
    ]);
    const result = decide(
      [`${C}/feed-event/feed-event.svelte`],
      orphanTree,
      feedKnownSlugs,
      [],
      composeOnly,
    );
    expect(result.mode).toBe('full');
  });

  it('still emits a standalone component’s own slug directly', () => {
    // Guards against over-broadly dropping direct slugs: `feed` itself is not
    // compose-only and must still appear when it changes.
    const result = decide([`${C}/feed/feed.svelte`], feedTree, feedKnownSlugs, [], composeOnly);
    expect(result).toEqual({ mode: 'filtered', components: ['feed'] });
  });

  it('forces full when a SHARED module reaches only compose-only components', () => {
    // A shared util consumed only by an orphaned compose-only leaf reaches a
    // "known" slug but no EMITTABLE (non-compose) one — so nothing would test the
    // shared change. The shared-seed guard must force full, not accept the
    // compose-only slug as coverage.
    const sharedReachingOnlyComposeOnly = new Map<string, string>([
      [`${U}/feed-helper.ts`, `export const h = () => '';`],
      [`${C}/feed-event/feed-event.svelte`, `import { h } from '../../utilities/feed-helper.ts';`],
      // No `feed` parent imports feed-event here → the only dependent is compose-only.
    ]);
    const result = decide(
      [`${U}/feed-helper.ts`],
      sharedReachingOnlyComposeOnly,
      feedKnownSlugs,
      [],
      composeOnly,
    );
    expect(result.mode).toBe('full');
  });
});

describe('changed-components explicit component scope', () => {
  it('treats an empty explicit component list as a full matrix', () => {
    expect(decideExplicitComponents('', knownSlugs)).toEqual({
      mode: 'full',
      reason: 'explicit component scope empty',
    });
  });

  it('normalizes explicit component slugs', () => {
    expect(decideExplicitComponents('button, accordion,button', knownSlugs)).toEqual({
      mode: 'filtered',
      components: ['accordion', 'button'],
    });
  });

  it('rejects unknown explicit component slugs', () => {
    expect(() => decideExplicitComponents('button,ghost', knownSlugs)).toThrow(/ghost/);
  });

  // `knownSlugs` (filesystem) includes compose-only leaves with no standalone
  // Playwright page. Dispatching one must fail FAST in the scope job, not get
  // emitted and rejected later by the runner manifest.
  it('rejects a compose-only leaf in explicit scope (fails fast, not in the runner)', () => {
    const known = new Set(['feed', 'feed-event']);
    const composeOnly = new Set(['feed-event']);
    expect(() => decideExplicitComponents('feed-event', known, composeOnly)).toThrow(/feed-event/);
    // A standalone slug in the same tree still resolves.
    expect(decideExplicitComponents('feed', known, composeOnly)).toEqual({
      mode: 'filtered',
      components: ['feed'],
    });
  });
});

// ---------------------------------------------------------------------------
// Integration: run the ACTUAL CLI from the repo root, exactly as CI does.
// ---------------------------------------------------------------------------

describe('changed-components CLI (integration, real tree)', () => {
  function runCli(changedPaths: string[]): { mode: string; components: string } {
    const env: NodeJS.ProcessEnv = { ...process.env, GITHUB_OUTPUT: '' };
    delete env['CINDER_TEST_COMPONENTS'];
    const result = spawnSync('bun', ['run', 'packages/testing/scripts/changed-components.ts'], {
      cwd: workspaceRoot,
      input: changedPaths.join('\n') + '\n',
      encoding: 'utf-8',
      env,
    });
    expect(result.status).toBe(0);
    const stdout = result.stdout ?? '';
    const mode = /component_scope_mode=(\w+)/.exec(stdout)?.[1] ?? '';
    expect(/^mode=(\w+)/m.exec(stdout)?.[1]).toBe(mode);
    const components = /components=([^\n]*)/.exec(stdout)?.[1] ?? '';
    return { mode, components };
  }

  function runCliWithExplicitComponents(componentScope: string): {
    mode: string;
    components: string;
  } {
    const result = spawnSync('bun', ['run', 'packages/testing/scripts/changed-components.ts'], {
      cwd: workspaceRoot,
      input: '',
      encoding: 'utf-8',
      env: { ...process.env, GITHUB_OUTPUT: '', CINDER_TEST_COMPONENTS: componentScope },
    });
    expect(result.status).toBe(0);
    const stdout = result.stdout ?? '';
    const mode = /component_scope_mode=(\w+)/.exec(stdout)?.[1] ?? '';
    expect(/^mode=(\w+)/m.exec(stdout)?.[1]).toBe(mode);
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

  it('a real compose-only leaf change maps to its parent slug, never emitting the leaf', () => {
    // End-to-end proof that the production COMPOSE_ONLY_COMPONENTS default is
    // threaded: `feed-event` is compose-only (rendered by `feed`), so a change to
    // it must emit `feed` and never `feed-event` (which the Playwright runner
    // would reject as an unknown slug). Guards the original bug at the real-tree
    // level, not just the synthetic-fixture level.
    const { mode, components } = runCli([
      'packages/components/src/components/feed-event/feed-event.svelte',
    ]);
    expect(mode).toBe('filtered');
    const slugs = components.split(',');
    expect(slugs).toContain('feed');
    expect(slugs).not.toContain('feed-event');
  });

  it('the lockfile forces full', () => {
    expect(runCli(['bun.lock'])).toEqual({ mode: 'full', components: '' });
  });

  it('explicit component scope emits both scope keys without reading changed files', () => {
    expect(runCliWithExplicitComponents('button')).toEqual({
      mode: 'filtered',
      components: 'button',
    });
  });

  it('a real example change is filtered to its slug', () => {
    const { mode, components } = runCli([
      'packages/playground/src/examples/accordion/basic.example.svelte',
    ]);
    expect(mode).toBe('filtered');
    expect(components.split(',')).toContain('accordion');
  });
});
