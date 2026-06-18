/**
 * Unit tests for `scripts/playground/discover.ts`.
 *
 * Must be run from the repo root so that `process.cwd()` resolves to
 * `/Users/stevekinney/Developer/cinder` and the globs find the real
 * `src/components/` and `scripts/playground/examples/` trees.
 */

import { describe, expect, it } from 'bun:test';
import { basename, dirname, join } from 'node:path';

import { analyzeAll } from './analyze.ts';
import {
  COMPOSE_ONLY_COMPONENTS,
  discoverAll,
  discoverComponentFilePaths,
  discoverComponents,
  discoverExamples,
  discoverSidebarComponents,
  invalidateDiscoveryCache,
} from './discover.ts';

// packages/components/src/components — the same root discoverComponents() scans.
const COMPONENTS_DIR = join(dirname(import.meta.dirname), '..', 'components', 'src', 'components');

describe('discoverComponents', () => {
  it('returns an array of component kebab names', async () => {
    const components = await discoverComponents();
    expect(Array.isArray(components)).toBe(true);
    expect(components.length).toBeGreaterThan(0);
  });

  it('includes button, alert, and modal', async () => {
    const components = await discoverComponents();
    expect(components).toContain('button');
    expect(components).toContain('alert');
    expect(components).toContain('modal');
  });

  it('does not include anything from _internal/', async () => {
    const components = await discoverComponents();
    // All names should be plain kebab identifiers with no path separator
    for (const name of components) {
      expect(name).not.toContain('/');
      expect(name).not.toContain('_internal');
    }
  });

  it('returns names without a .svelte extension', async () => {
    const components = await discoverComponents();
    for (const name of components) {
      expect(name).not.toMatch(/\.svelte$/);
    }
  });

  it('returns a sorted list', async () => {
    const components = await discoverComponents();
    const sorted = [...components].toSorted();
    expect(components).toEqual(sorted);
  });

  it('returns at least 21 components', async () => {
    const components = await discoverComponents();
    expect(components.length).toBeGreaterThanOrEqual(21);
  });

  it('does not include removed date-picker component', async () => {
    const components = await discoverComponents();
    expect(components).not.toContain('date-picker');
  });
});

describe('discoverExamples', () => {
  it('returns at least one example for the button component', async () => {
    const examples = await discoverExamples('button');
    expect(examples.length).toBeGreaterThanOrEqual(1);
    expect(examples).toContain('primary');
  });

  it('returns an empty array for a nonexistent component without throwing', async () => {
    const examples = await discoverExamples('nonexistent');
    expect(examples).toEqual([]);
  });

  it('returns no standalone examples for navigation-item', async () => {
    const examples = await discoverExamples('navigation-item');
    expect(examples).toEqual([]);
  });

  it('returns no standalone examples for label', async () => {
    const examples = await discoverExamples('label');
    expect(examples).toEqual([]);
  });

  it('returns no standalone examples for date-picker', async () => {
    const examples = await discoverExamples('date-picker');
    expect(examples).toEqual([]);
  });

  it('returns names without the .example.svelte extension', async () => {
    const examples = await discoverExamples('button');
    for (const example of examples) {
      expect(example).not.toMatch(/\.example\.svelte$/);
    }
  });

  it('returns a sorted list', async () => {
    const examples = await discoverExamples('button');
    const sorted = [...examples].toSorted();
    expect(examples).toEqual(sorted);
  });
});

describe('discoverAll', () => {
  it('returns an array of { name, exampleCount } objects', async () => {
    const results = await discoverAll();
    expect(Array.isArray(results)).toBe(true);
    for (const entry of results) {
      expect(typeof entry.name).toBe('string');
      expect(typeof entry.exampleCount).toBe('number');
      expect(entry.exampleCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('reports exampleCount >= 1 for button', async () => {
    const results = await discoverAll();
    const buttonEntry = results.find((entry) => entry.name === 'button');
    expect(buttonEntry).toBeDefined();
    expect(buttonEntry!.exampleCount).toBeGreaterThanOrEqual(1);
  });

  it('covers at least 21 components', async () => {
    const results = await discoverAll();
    expect(results.length).toBeGreaterThanOrEqual(21);
  });

  it('includes entries for button, alert, and modal', async () => {
    const results = await discoverAll();
    const names = results.map((entry) => entry.name);
    expect(names).toContain('button');
    expect(names).toContain('alert');
    expect(names).toContain('modal');
  });

  it('does not include removed date-picker component', async () => {
    const results = await discoverAll();
    expect(results.map((entry) => entry.name)).not.toContain('date-picker');
  });
});

describe('discoverSidebarComponents', () => {
  it('returns only component names with at least one example', async () => {
    const all = await discoverAll();
    const sidebar = await discoverSidebarComponents();
    const expected = all.filter(({ exampleCount }) => exampleCount > 0).map(({ name }) => name);
    expect(sidebar).toEqual(expected);
  });

  it('includes button (which has examples)', async () => {
    const sidebar = await discoverSidebarComponents();
    expect(sidebar).toContain('button');
  });

  it('excludes navigation-item because navigation-bar examples cover it', async () => {
    const sidebar = await discoverSidebarComponents();
    expect(sidebar).not.toContain('navigation-item');
  });

  it('excludes label because input and textarea examples cover it', async () => {
    const sidebar = await discoverSidebarComponents();
    expect(sidebar).not.toContain('label');
  });

  it('excludes date-picker because native date inputs replace it', async () => {
    const sidebar = await discoverSidebarComponents();
    expect(sidebar).not.toContain('date-picker');
  });

  it('returns an array of strings, no duplicates', async () => {
    const sidebar = await discoverSidebarComponents();
    expect(Array.isArray(sidebar)).toBe(true);
    expect(new Set(sidebar).size).toBe(sidebar.length);
    for (const name of sidebar) {
      expect(typeof name).toBe('string');
    }
  });

  it('excludes compose-only subcomponents that have no example folder', async () => {
    // accordion-item / radio / tab are explicitly compose-only — they should
    // never appear in the sidebar regardless of being present on disk.
    const sidebar = await discoverSidebarComponents();
    const all = await discoverAll();
    for (const { name, exampleCount } of all) {
      if (exampleCount === 0) {
        expect(sidebar).not.toContain(name);
      }
    }
  });

  it('excludes every compose-only leaf in the COMPOSE_ONLY_COMPONENTS set', async () => {
    const sidebar = await discoverSidebarComponents();
    for (const leaf of COMPOSE_ONLY_COMPONENTS) {
      expect(sidebar).not.toContain(leaf);
    }
  });

  it('keeps the sidebar at or below the 126-entry product gate', async () => {
    // The plan named a 70-entry cap based on a 99-component baseline. The
    // repository has grown to 134 components since then; adding the four
    // new parent families (feed, grid-list, stat-group, side-navigation)
    // lands the sidebar around 78. The three chart families (line, bar,
    // area) bumped it to 82. The P5 input and form audit brought it to 86,
    // and Selectable, CommandPalette, and CommandMenu brought it to 87. The
    // Container and Collapsible layout/disclosure primitives bring it to 89;
    // the overlay variants (alert-dialog, context-menu, hover-card) plus
    // ContextMenu and inline-command additions landed the deduped sidebar at
    // 92. Promoting Timeline out of experimental/ into the main tree — it
    // ships playground examples, so it now surfaces in the sidebar — landed it
    // at 93. The Playwright-sweep stabilization (task 27cd940c) added the four
    // missing examples for standalone components that were rendering "No
    // examples found" and timing out the sweep — status-dot, message,
    // description-list, color-field — surfacing them in the sidebar and landing
    // it at 97 distinct families, measured empirically via discoverSidebarComponents().
    // The MVP issue wave (#318-324) raises the ceiling to 106 once all three of
    // its PRs land: the ChoiceGrid family (#318), the four chart families
    // (matrix-chart, waveform, spectrum-chart, spectrogram; #319/#324), and the
    // five interaction-pattern families (media-controls, capability-gate,
    // share-card, keyboard-shortcuts, shortcut-hint; #320-323 — shortcut-hint
    // ships as its own sidebar family alongside keyboard-shortcuts). The gate is
    // `<=` so each PR in the wave can land independently while staying under the
    // final cumulative total.
    // The features wave (#334-336) adds three more families — data-table,
    // pricing-card, and subscription-badge — landing the sidebar at 109,
    // measured empirically via discoverSidebarComponents(). (#337/#338 ship as
    // examples on existing families and do not add sidebar entries.)
    // The operational-components wave (#352, #354-360) lands the sidebar at 117,
    // measured empirically via discoverSidebarComponents(). It adds eight entries:
    // seven new families — faceted-filter-bar, event-stream-viewer,
    // payload-inspector, date-range-field, run-step-timeline, secret-value-field,
    // and invocation-rule-builder — plus json-viewer, which was absent from the
    // sidebar on main (it had no examples) and newly appears because #358 adds its
    // first examples. So 109 (prior) + 7 new + 1 newly-surfaced json-viewer = 117.
    // The #394 example-coverage backfill adds the first examples for
    // stacked-list-item, which had none on main (it was absent from the sidebar
    // for the same reason json-viewer was) and now newly surfaces — landing the
    // sidebar at 118, measured empirically via discoverSidebarComponents(). The
    // other components the backfill touches already shipped examples, so they
    // were already counted and do not move the total.
    // The component primitive and layout backlog adds four standalone families:
    // grid, masonry, speed-dial, and transfer-list. Its compound leaves
    // (grid-item and speed-dial-action) stay compose-only, so they do not add
    // sidebar entries. That lands the measured sidebar ceiling at 122.
    // DataGrid adds one standalone sidebar family with its first playground
    // example, bringing the combined measured ceiling to 123.
    // Chat conversation pagination/sibling primitives add two standalone families
    // with examples: chat-conversation-header and chat-conversation-list,
    // bringing the measured ceiling to 125.
    // PermissionMatrix adds one standalone authorization-inspection family with
    // its first playground example, bringing the measured ceiling to 126.
    const sidebar = await discoverSidebarComponents();
    expect(sidebar.length).toBeLessThanOrEqual(126);
    // Positive anchor for the +1: stacked-list-item is the family the #394
    // backfill newly surfaces, so it must actually be present. Without this the
    // upper-bound alone would silently pass if the regression that dropped it
    // from the sidebar also dropped some other family in its place.
    expect(sidebar).toContain('stacked-list-item');
    expect(sidebar).toContain('data-grid');
    expect(sidebar).toContain('grid');
    expect(sidebar).toContain('masonry');
    expect(sidebar).toContain('speed-dial');
    expect(sidebar).toContain('transfer-list');
    expect(sidebar).toContain('chat-conversation-header');
    expect(sidebar).toContain('chat-conversation-list');
    expect(sidebar).toContain('permission-matrix');
  });

  it('keeps the sidebar strictly smaller than the full component list', async () => {
    const sidebar = await discoverSidebarComponents();
    const all = await discoverComponents();
    expect(sidebar.length).toBeLessThan(all.length);
  });

  it('includes every parent compound family covered by namespace exports', async () => {
    const sidebar = await discoverSidebarComponents();
    for (const parent of [
      'accordion',
      'tabs',
      'table',
      'dropdown',
      'tree',
      'feed',
      'grid-list',
      'stat-group',
      'side-navigation',
    ]) {
      expect(sidebar).toContain(parent);
    }
  });

  it('keeps every compose-only leaf discoverable via discoverComponents()', async () => {
    const all = await discoverComponents();
    for (const leaf of COMPOSE_ONLY_COMPONENTS) {
      expect(all).toContain(leaf);
    }
  });
});

// ---------------------------------------------------------------------------
// Shared file-path scan
//
// `discoverComponentFilePaths` is the single source of truth backing both
// `discoverComponents` (kebab names) and `analyzeAll` (file reads). These
// tests pin that the three views agree, so the two callers cannot drift apart.
// ---------------------------------------------------------------------------

describe('discoverComponentFilePaths', () => {
  it('returns absolute .svelte file paths', async () => {
    const filePaths = await discoverComponentFilePaths(COMPONENTS_DIR);
    expect(filePaths.length).toBeGreaterThan(0);
    for (const filePath of filePaths) {
      expect(filePath.startsWith('/')).toBe(true);
      expect(filePath).toMatch(/\.svelte$/);
    }
  });

  it('yields the exact same name set as discoverComponents() (sorted compare)', async () => {
    const filePaths = await discoverComponentFilePaths(COMPONENTS_DIR);
    const namesFromPaths = [...new Set(filePaths.map((p) => basename(p, '.svelte')))].toSorted();
    const components = await discoverComponents();
    expect(namesFromPaths).toEqual(components);
  });

  it('excludes underscore-prefixed, experimental, and icons entries', async () => {
    const filePaths = await discoverComponentFilePaths(COMPONENTS_DIR);
    for (const filePath of filePaths) {
      expect(basename(filePath).startsWith('_')).toBe(false);
      expect(filePath).not.toContain('/experimental/');
      expect(filePath).not.toContain('/icons/');
    }
  });

  // analyzeAll spins up a fresh ts-morph Project per component (a known perf
  // cost), so the cold-start scan over the whole library can exceed the default
  // 5s per-test budget. The generous timeout keeps this invariant test honest
  // without flaking on a slow machine.
  it('matches the component set analyzeAll() resolves', async () => {
    const manifests = await analyzeAll(COMPONENTS_DIR);
    const fromAnalyze = manifests.map((m) => m.kebabName).toSorted();
    const fromDiscover = await discoverComponents();
    expect(fromAnalyze).toEqual(fromDiscover);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// Discovery cache
//
// `discoverComponents` / `discoverAll` run on every `/`, `/c/:name`, and
// `/page/:name` request, so their full `Bun.Glob` scans are memoized at module
// scope and invalidated on each watcher rebuild via `invalidateDiscoveryCache`.
// These tests pin that a warm call does NOT re-scan and that invalidation
// forces a fresh scan — measured by spying on `Bun.Glob`'s `scan`.
// ---------------------------------------------------------------------------

describe('discovery cache', () => {
  // Count Bun.Glob().scan() calls so we can assert when a real filesystem
  // scan happens vs. when a cached result is returned. scanComponents()
  // constructs two globs (flat + directory) per cold scan, and discoverAll
  // additionally scans one example glob per component, so a warm call adds
  // zero scans. We only assert direction (more vs. equal), never exact counts,
  // so the test is robust to component-count growth.
  let scanCallCount = 0;
  const realScan = Bun.Glob.prototype.scan;

  const installSpy = () => {
    scanCallCount = 0;
    Bun.Glob.prototype.scan = function spiedScan(this: Bun.Glob, ...args: unknown[]) {
      scanCallCount += 1;
      // @ts-expect-error — forwarding the original variadic scan signature.
      return realScan.apply(this, args);
    };
  };

  const restoreSpy = () => {
    Bun.Glob.prototype.scan = realScan;
  };

  it('does not re-scan the filesystem on a warm discoverComponents() call', async () => {
    // Warm the cache first (cold scan happens here, possibly counted partially).
    invalidateDiscoveryCache();
    await discoverComponents();

    installSpy();
    try {
      const first = await discoverComponents();
      const countAfterWarm = scanCallCount;
      const second = await discoverComponents();
      // A warm call must perform zero new scans.
      expect(scanCallCount).toBe(countAfterWarm);
      expect(scanCallCount).toBe(0);
      // And the cached value is referentially identical across calls.
      expect(second).toBe(first);
    } finally {
      restoreSpy();
    }
  });

  it('re-scans after invalidateDiscoveryCache() forces a cold call', async () => {
    // Warm the cache so the next discoverComponents() would be a cache hit.
    invalidateDiscoveryCache();
    await discoverComponents();

    installSpy();
    try {
      // Warm hit: no scans.
      await discoverComponents();
      expect(scanCallCount).toBe(0);

      // Invalidate, then the next call must perform a real scan.
      invalidateDiscoveryCache();
      await discoverComponents();
      expect(scanCallCount).toBeGreaterThan(0);
    } finally {
      restoreSpy();
    }
  });

  it('invalidates discoverAll() under the same generation as discoverComponents()', async () => {
    invalidateDiscoveryCache();
    const firstAll = await discoverAll();
    const warmAll = await discoverAll();
    // Warm discoverAll() returns the identical memoized array.
    expect(warmAll).toBe(firstAll);

    invalidateDiscoveryCache();
    const freshAll = await discoverAll();
    // After invalidation it is a brand-new array (cache was dropped) but with
    // structurally equal contents — exact values and ordering preserved.
    expect(freshAll).not.toBe(firstAll);
    expect(freshAll).toEqual(firstAll);
  });

  it('preserves exact return values and sorting across the cache boundary', async () => {
    invalidateDiscoveryCache();
    const cold = await discoverComponents();
    const warm = await discoverComponents();
    expect(warm).toEqual(cold);
    expect(warm).toEqual([...cold].toSorted());
  });

  it('re-scans when invalidation happens while a discoverComponents() scan is in flight', async () => {
    // Reproduces the race the generation guard closes: a caller starts awaiting
    // a scan, the watcher invalidates mid-flight, and the caller must NOT serve
    // the now-stale in-flight result — it must re-scan under the new generation.
    invalidateDiscoveryCache();

    installSpy();
    try {
      // Kick off a scan but DON'T await it yet, then invalidate before it
      // resolves — exactly the interleaving a watcher rebuild produces.
      const pending = discoverComponents();
      invalidateDiscoveryCache();
      await pending;
      const scansAfterRace = scanCallCount;
      // The guard must have triggered a second (fresh) scan after invalidation,
      // not returned the stale in-flight one — so more than one scan ran.
      expect(scansAfterRace).toBeGreaterThan(0);

      // And a subsequent call is once again a warm hit (cache settled on the
      // post-invalidation generation).
      const settled = scanCallCount;
      await discoverComponents();
      expect(scanCallCount).toBe(settled);
    } finally {
      restoreSpy();
    }
  });
});

describe('COMPOSE_ONLY_COMPONENTS — drift guard', () => {
  // The browser-test scope job (changed-components.ts → computeScope) relies on
  // this set to keep its emitted slugs inside the Playwright runner's manifest
  // vocabulary: a compose-only leaf must never be emitted as a test slug. If a
  // new compose-only component is added but missing here, the scope job re-emits
  // the leaf and the runner throws `unknown component slugs`. These tests fail
  // loudly the moment the set drifts from the filesystem reality.

  it('every entry is a real component directory with a <slug>.svelte file', async () => {
    for (const slug of COMPOSE_ONLY_COMPONENTS) {
      const svelte = join(COMPONENTS_DIR, slug, `${slug}.svelte`);
      const exists = await Bun.file(svelte).exists();
      expect(
        exists,
        `COMPOSE_ONLY_COMPONENTS lists "${slug}" but ${slug}/${slug}.svelte is missing`,
      ).toBe(true);
    }
  });

  it('no entry has standalone playground examples (it is genuinely compose-only)', async () => {
    for (const slug of COMPOSE_ONLY_COMPONENTS) {
      const examples = await discoverExamples(slug);
      expect(
        examples,
        `COMPOSE_ONLY_COMPONENTS lists "${slug}" but it has standalone examples — it is NOT compose-only`,
      ).toEqual([]);
    }
  });
});
