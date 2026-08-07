/**
 * Unit tests for `scripts/playground/discover.ts`.
 *
 * Must be run from the repo root so that `process.cwd()` resolves to
 * `/Users/stevekinney/Developer/cinder` and the globs find the real
 * `src/components/` and `scripts/playground/examples/` trees.
 */

import { describe, expect, it } from 'bun:test';
import { basename, dirname, join } from 'node:path';

import { analyzeComponent } from './analyze.ts';
import { CHAT_COMPONENT_SOURCE, CINDER_COMPONENT_SOURCE } from './component-sources.ts';
import {
  COMPOSE_ONLY_COMPONENTS,
  assertUniqueComponentSlugs,
  discoverAll,
  discoverComponentDefinitions,
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

  it('includes date-picker', async () => {
    const components = await discoverComponents();
    expect(components).toContain('date-picker');
  });

  it('includes the extracted Chat package under the existing route slugs', async () => {
    const definitions = await discoverComponentDefinitions();
    const chatDefinitions = definitions.filter((entry) => entry.source.id === 'chat');
    expect(chatDefinitions.map((entry) => entry.name)).toEqual([
      'chat',
      'chat-composer-popover',
      'chat-conversation-header',
      'chat-conversation-list',
    ]);
    expect(chatDefinitions.map((entry) => entry.importPath)).toEqual([
      '@lostgradient/chat',
      '@lostgradient/chat/composer-popover',
      '@lostgradient/chat/conversation-header',
      '@lostgradient/chat/conversation-list',
    ]);
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

  it('returns standalone examples for date-picker', async () => {
    const examples = await discoverExamples('date-picker');
    expect(examples).toEqual(['basic', 'date-time']);
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

  it('includes date-picker component metadata', async () => {
    const results = await discoverAll();
    const datePickerEntry = results.find((entry) => entry.name === 'date-picker');
    expect(datePickerEntry?.exampleCount).toBe(2);
  });
});

// Snapshot of every family discoverSidebarComponents() currently returns, sorted for a stable
// diff. When this test fails because you intentionally added or removed a sidebar family,
// regenerate this array — do not delete entries to make the test pass without confirming the
// removal (or addition) was intentional.
const SIDEBAR_BASELINE = [
  'access-gate',
  'accordion',
  'action-row',
  'alert',
  'alert-dialog',
  'approval-card',
  'area-chart',
  'aspect-ratio',
  'autocomplete',
  'avatar',
  'avatar-group',
  'backdrop',
  'badge',
  'banner',
  'bar-chart',
  'bento-grid',
  'blog-section',
  'breadcrumbs',
  'button',
  'button-group',
  'calendar',
  'call-to-action-section',
  'callout',
  'capability-gate',
  'card',
  'carousel',
  'chat',
  'chat-composer-popover',
  'chat-conversation-header',
  'chat-conversation-list',
  'checkbox',
  'checkbox-group',
  'chip',
  'choice-grid',
  'click-away-listener',
  'code-block',
  'collapsible',
  'color-field',
  'color-picker',
  'color-swatch-picker',
  'combobox',
  'command-menu',
  'command-palette',
  'confirm-dialog',
  'connection-indicator',
  'container',
  'context-menu',
  'copy-button',
  'data-grid',
  'data-list',
  'data-table',
  'date-picker',
  'date-range-field',
  'description-list',
  'diff-statistics',
  'diff-viewer',
  'divider',
  'drawer',
  'dropdown',
  'empty-state',
  'faceted-filter-bar',
  'feature-section',
  'feed',
  'file-upload',
  'floating-action',
  'focus-trap',
  'footer',
  'form-field',
  'form-section',
  'grid',
  'grid-list',
  'hero-section',
  'hover-card',
  'image',
  'inline-loading',
  'input',
  'invocation-rule-builder',
  'json-editor',
  'json-schema-editor',
  'json-viewer',
  'kanban-board',
  'kbd',
  'keyboard-shortcuts',
  'line-chart',
  'link',
  'load-more',
  'logo-cloud',
  'markdown-editor',
  'marquee',
  'masonry',
  'matrix-chart',
  'media-controls',
  'mega-menu',
  'menu-bar',
  'message',
  'meter',
  'modal',
  'multi-select',
  'navigation-bar',
  'newsletter-section',
  'number-input',
  'page-header',
  'pagination',
  'payload-inspector',
  'permission-matrix',
  'phone-input',
  'pin-input',
  'popover',
  'portal',
  'pricing-card',
  'pricing-section',
  'progress',
  'qr-code',
  'radio-group',
  'rating',
  'resizable-panels',
  'review-editor',
  'run-step-timeline',
  'schedule-builder',
  'schema-form',
  'scroll-area',
  'search-field',
  'secret-value-field',
  'section-heading',
  'segmented-control',
  'select',
  'selectable-row',
  'selection-popover',
  'share-card',
  'shortcut-hint',
  'side-navigation',
  'sidebar',
  'skeleton',
  'skip-link',
  'slider',
  'sortable-list',
  'source-diff-viewer',
  'sparkbar',
  'spectrogram',
  'spectrum-chart',
  'speed-dial',
  'spinner',
  'stacked-list-item',
  'statistic-group',
  'statistics-section',
  'status-dot',
  'steps',
  'surface',
  'table',
  'table-of-contents',
  'tabs',
  'tag-input',
  'team-section',
  'testimonial-section',
  'textarea',
  'time-field',
  'timeline',
  'toast-region',
  'toggle',
  'toolbar',
  'tooltip',
  'transfer-list',
  'tree',
  'typography',
  'virtual-list',
  'visually-hidden',
  'waveform',
] as const;

/**
 * Two-directional membership diff: `missing` names a baseline entry that
 * disappeared from `actual` (almost always a discovery regression); `unexpected`
 * names an `actual` entry not yet recorded in `baseline` (usually an
 * intentional addition that forgot to update the baseline).
 */
function diffSidebarBaseline(
  baseline: readonly string[],
  actual: readonly string[],
): { missing: string[]; unexpected: string[] } {
  const actualSet = new Set(actual);
  const baselineSet = new Set(baseline);
  return {
    missing: baseline.filter((name) => !actualSet.has(name)),
    unexpected: actual.filter((name) => !baselineSet.has(name)),
  };
}

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

  it('includes date-picker because it has standalone examples', async () => {
    const sidebar = await discoverSidebarComponents();
    expect(sidebar).toContain('date-picker');
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

  it('keeps the sidebar in sync with the documented baseline', async () => {
    // The plan named a 70-entry cap based on a 99-component baseline. The
    // repository has grown to 134 components since then; adding the four
    // new parent families (feed, grid-list, statistic-group, side-navigation)
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
    // The features wave (#334-336) added three more families — data-table,
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
    // AccessGate adds one standalone authorization-state primitive with examples,
    // bringing the measured ceiling to 127.
    // SchemaForm adds one public form family with a JSON Schema example, bringing
    // the measured ceiling to 128.
    // VirtualList adds one standalone windowing primitive with examples,
    // bringing the measured ceiling to 129.
    // The stable-component example backfill (#463) adds first examples for nine
    // standalone families that previously had none — banner, callout,
    // checkbox-group, color-swatch-picker, connection-indicator, file-upload,
    // image, number-input, and sortable-list — so each now passes the
    // `exampleCount > 0` filter and surfaces in the sidebar, bringing the measured
    // ceiling to 138. (segment and command-item were moved to COMPOSE_ONLY in the
    // same change, so they do NOT add entries.)
    // SubscriptionBadge later folded into Badge and ConnectionIndicator folded
    // into StatusDot, reducing the measured sidebar count by two.
    // TimeField adds one standalone internationalized time-entry family with
    // examples, bringing the measured ceiling to 137. LocaleProvider is
    // context-only and does not add a playground sidebar entry.
    // Stardust agent-ops adds approval-card as a standalone approval family with
    // examples, bringing the combined measured sidebar ceiling to 138.
    // BentoGrid adds one standalone layout family with examples. BentoCell is a
    // compose-only leaf and stays out of the sidebar, so the combined measured
    // ceiling rises to 139.
    // Meter adds one standalone feedback family with examples, bringing the
    // measured sidebar ceiling to 140.
    // MultiSelect adds one standalone multi-select family with examples, bringing
    // the measured sidebar ceiling to 141.
    // Issue #480 adds Carousel, Footer, and MegaMenu examples, each of which now
    // passes the `exampleCount > 0` sidebar filter, bringing the measured
    // ceiling to 144.
    // QrCode and Marquee each add their first standalone playground examples,
    // bringing the measured sidebar ceiling to 147. DatePicker now ships with
    // two standalone examples, raising the measured ceiling to 148. Chat adds
    // two more standalone composition families, bringing this branch to 150.
    // Marketing sections add 10 standalone families with examples, bringing the
    // measured ceiling to 160.
    // PageHeader adds one more standalone family with examples, bringing the
    // measured ceiling to 161.
    // Sparkbar and EventTimeline add two compact data-display families with
    // examples, bringing the measured ceiling to 163.
    // SourceDiffViewer adds one standalone source-patch family with examples,
    // bringing the measured ceiling to 164.
    // ActionRow adds one selectable row primitive with examples, bringing the
    // measured ceiling to 165. ChatComposerPopover adds one standalone composer
    // suggestion primitive with examples, bringing the measured ceiling to 166.
    // InlineLoading and KanbanBoard each add a standalone sidebar family with
    // examples, bringing the measured ceiling to 168. SelectableRow adds one
    // standalone row-action family, bringing the measured ceiling to 169.
    // JsonEditor adds one standalone JSON source-editing family with examples,
    // bringing the measured ceiling to 170.
    // The `170` ceiling above is historical; it is superseded by the exact-membership `SIDEBAR_BASELINE` check below.
    const sidebar = await discoverSidebarComponents();

    const { missing, unexpected } = diffSidebarBaseline(SIDEBAR_BASELINE, sidebar);

    // A non-empty `missing` array means a family that used to be in the sidebar disappeared —
    // almost always a discovery regression (bad glob, misconfiguration, slug collision).
    expect(missing).toEqual([]);
    // A non-empty `unexpected` array means a new family was added without updating
    // SIDEBAR_BASELINE above — intentional; add the new name(s) to the array.
    expect(unexpected).toEqual([]);

    // The two Set-based checks above are diagnostic: they name exactly which family is missing
    // or unexpected, which is more useful for debugging than a single array-equality failure.
    // But Set comparison alone cannot detect a duplicate entry (the same name appearing twice
    // in `sidebar`) or an ordering change. `discoverSidebarComponents()` returns entries sorted
    // alphabetically by `localeCompare` (via `discoverComponentDefinitions()`'s
    // `.toSorted((left, right) => left.name.localeCompare(right.name))` in `discover.ts`), and
    // `SIDEBAR_BASELINE` above is written in that same sorted order — so exact array equality is
    // a valid, stronger assertion, not an accident of this baseline's construction. Assert it too:
    expect(sidebar).toEqual([...SIDEBAR_BASELINE]);
  });

  describe('sidebar baseline diff', () => {
    it('reports a dropped family as missing', () => {
      const { missing, unexpected } = diffSidebarBaseline(['a', 'b'], ['a']);
      expect(missing).toEqual(['b']);
      expect(unexpected).toEqual([]);
    });

    it('reports an added family as unexpected', () => {
      const { missing, unexpected } = diffSidebarBaseline(['a'], ['a', 'b']);
      expect(missing).toEqual([]);
      expect(unexpected).toEqual(['b']);
    });

    it('does not mask a duplicate entry as a clean pass', () => {
      // Set-based diffing alone treats ['a', 'a', 'b'] as equal to ['a', 'b']; the exact-array
      // equality assertion in the baseline test above is what actually catches this — this case
      // documents why both checks are required, not just the Set diff.
      expect(['a', 'a', 'b']).not.toEqual(['a', 'b']);
    });
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
      'statistic-group',
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

  it('yields the exact same Cinder name set as package-aware discovery', async () => {
    const filePaths = await discoverComponentFilePaths(COMPONENTS_DIR);
    const namesFromPaths = [...new Set(filePaths.map((p) => basename(p, '.svelte')))].toSorted();
    const definitions = await discoverComponentDefinitions();
    const components = definitions
      .filter((component) => component.source.id === 'cinder')
      .map((component) => component.name);
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
  it('matches the component set the analyzer resolves across packages', async () => {
    const definitions = await discoverComponentDefinitions();
    const manifests = await Promise.all(
      definitions.map((definition) =>
        analyzeComponent(definition.filePath, { importPath: definition.importPath }),
      ),
    );
    const fromAnalyze = manifests.map((m) => m.kebabName).toSorted();
    const fromDiscover = await discoverComponents();
    expect(fromAnalyze).toEqual(fromDiscover);
  }, 60_000);

  it('rejects duplicate route slugs claimed by two packages', () => {
    expect(() =>
      assertUniqueComponentSlugs([
        {
          name: 'conversation-surface',
          filePath: '/tmp/cinder/conversation-surface.svelte',
          importPath: '@lostgradient/cinder/conversation-surface',
          source: CINDER_COMPONENT_SOURCE,
        },
        {
          name: 'conversation-surface',
          filePath: '/tmp/chat/conversation-surface.svelte',
          importPath: '@lostgradient/chat/conversation-surface',
          source: CHAT_COMPONENT_SOURCE,
        },
      ]),
    ).toThrow(
      /duplicate component slug "conversation-surface".*@lostgradient\/cinder.*@lostgradient\/chat/,
    );
  });
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
