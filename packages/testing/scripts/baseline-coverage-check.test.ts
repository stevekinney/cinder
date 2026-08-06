/**
 * Unit tests for findMissingBaselines() from baseline-coverage-check.ts.
 *
 * We use a fake manifest and write a fake snapshot tree under a temp directory
 * so the tests run without touching the real snapshots/ folder and without
 * needing a running playground server.
 *
 * Strategy:
 *   - Mock snapshotPath to resolve against our tmp directory.
 *   - Build fake ComponentEntry arrays and fake snapshot files.
 *   - Verify findMissingBaselines() returns the right missing entries.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ManifestFixtureEntry } from '../src/helpers/manifest.ts';
import {
  applyBaselineComponentFilter,
  evaluateBaselineCoverage,
  expectedBaselineFileNames,
  findMissingBaselines,
  findOrphanBaselines,
  isAdoptedSlug,
  readBaselineFiles,
  TARGETED_TEST_COMBINATIONS,
} from './baseline-coverage-check.ts';

// ---------------------------------------------------------------------------
// Fake snapshot root
// ---------------------------------------------------------------------------

const TMP_ROOT = join(import.meta.dir, '..', 'tmp', 'baseline-coverage-check-test');

function snapshotFilePath(slug: string, theme: string, viewport: string, fixture: string): string {
  return join(TMP_ROOT, 'snapshots', slug, `${theme}-${viewport}-${fixture}.png`);
}

function writeFakeSnapshot(slug: string, theme: string, viewport: string, fixture: string): void {
  const filePath = snapshotFilePath(slug, theme, viewport, fixture);
  mkdirSync(join(TMP_ROOT, 'snapshots', slug), { recursive: true });
  writeFileSync(filePath, 'fake-png-data');
}

// ---------------------------------------------------------------------------
// We need to redirect snapshotPath() to our tmp directory.
// We do this by mocking the artifact-path module.
// ---------------------------------------------------------------------------

mock.module('../src/helpers/artifact-path.ts', () => ({
  snapshotPath: (key: { slug: string; theme: string; viewport: string; fixture: string }) =>
    snapshotFilePath(key.slug, key.theme, key.viewport, key.fixture),
}));

// ---------------------------------------------------------------------------
// Fake component entries
// ---------------------------------------------------------------------------

type FakeEntry = {
  name: string;
  slug: string;
  route: string;
  fixtures?: ManifestFixtureEntry[];
};

function makeFixture(name: string): ManifestFixtureEntry {
  return {
    name,
    mode: 'direct',
    fixtureContentHash: '0'.repeat(64),
    category: 'visual-contract',
  };
}

function makeEntry(slug: string, fixtures?: string[]): FakeEntry {
  if (fixtures !== undefined) {
    return { name: slug, slug, route: `/page/${slug}`, fixtures: fixtures.map(makeFixture) };
  }
  return { name: slug, slug, route: `/page/${slug}` };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  mkdirSync(TMP_ROOT, { recursive: true });
});

afterEach(() => {
  rmSync(TMP_ROOT, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('findMissingBaselines — all baselines present', () => {
  it('returns an empty array when every expected snapshot file exists', () => {
    const entries = [makeEntry('button')];

    // button has no explicit fixtures → synthesised 'default'
    // THEMES: light, dark | VIEWPORTS: mobile, tablet, desktop
    for (const theme of ['light', 'dark']) {
      for (const viewport of ['mobile', 'tablet', 'desktop']) {
        writeFakeSnapshot('button', theme, viewport, 'default');
      }
    }

    const missing = findMissingBaselines(entries);
    expect(missing).toHaveLength(0);
  });

  it('returns an empty array for a component with explicit fixtures', () => {
    const entries = [makeEntry('badge', ['open', 'closed'])];

    for (const theme of ['light', 'dark']) {
      for (const viewport of ['mobile', 'tablet', 'desktop']) {
        writeFakeSnapshot('badge', theme, viewport, 'open');
        writeFakeSnapshot('badge', theme, viewport, 'closed');
      }
    }

    const missing = findMissingBaselines(entries);
    expect(missing).toHaveLength(0);
  });
});

describe('applyBaselineComponentFilter', () => {
  it('keeps all entries when no component scope is set', () => {
    const entries = [makeEntry('button'), makeEntry('badge')];
    expect(applyBaselineComponentFilter(entries, undefined).map((entry) => entry.slug)).toEqual([
      'button',
      'badge',
    ]);
  });

  it('filters to the requested component scope', () => {
    const entries = [makeEntry('button'), makeEntry('badge')];
    expect(applyBaselineComponentFilter(entries, 'button').map((entry) => entry.slug)).toEqual([
      'button',
    ]);
  });

  it('rejects unknown component slugs with the shared parser message', () => {
    const entries = [makeEntry('button'), makeEntry('badge')];
    expect(() => applyBaselineComponentFilter(entries, 'button,ghost')).toThrow(
      /CINDER_TEST_COMPONENTS references unknown component slugs: ghost/,
    );
  });
});

describe('findMissingBaselines — some baselines missing', () => {
  it('reports missing entries when no snapshots exist', () => {
    const entries = [makeEntry('button')];
    // No snapshots written → all 6 combinations missing (2 themes × 3 viewports × 1 fixture)
    const missing = findMissingBaselines(entries);
    expect(missing).toHaveLength(6);
  });

  it('reports only the missing combination when one snapshot is absent', () => {
    const entries = [makeEntry('button')];

    // Write all except dark-desktop-default
    for (const theme of ['light', 'dark']) {
      for (const viewport of ['mobile', 'tablet', 'desktop']) {
        if (theme === 'dark' && viewport === 'desktop') continue;
        writeFakeSnapshot('button', theme, viewport, 'default');
      }
    }

    const missing = findMissingBaselines(entries);
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      slug: 'button',
      theme: 'dark',
      viewport: 'desktop',
      fixture: 'default',
    });
  });

  it('reports missing per-fixture entries for a component with explicit fixtures', () => {
    const entries = [makeEntry('badge', ['open', 'closed'])];

    // Write only the 'open' snapshots, not 'closed'
    for (const theme of ['light', 'dark']) {
      for (const viewport of ['mobile', 'tablet', 'desktop']) {
        writeFakeSnapshot('badge', theme, viewport, 'open');
      }
    }

    const missing = findMissingBaselines(entries);
    // All 6 'closed' combinations should be missing
    expect(missing).toHaveLength(6);
    for (const item of missing) {
      expect(item.fixture).toBe('closed');
      expect(item.slug).toBe('badge');
    }
  });
});

describe('findMissingBaselines — multiple components', () => {
  it('aggregates missing entries across components', () => {
    const entries = [makeEntry('button'), makeEntry('badge')];

    // Write all snapshots for button, none for badge
    for (const theme of ['light', 'dark']) {
      for (const viewport of ['mobile', 'tablet', 'desktop']) {
        writeFakeSnapshot('button', theme, viewport, 'default');
      }
    }

    const missing = findMissingBaselines(entries);
    expect(missing).toHaveLength(6); // 6 missing for badge
    for (const item of missing) {
      expect(item.slug).toBe('badge');
    }
  });

  it('returns an empty array when all components have all snapshots', () => {
    const entries = [makeEntry('button'), makeEntry('badge')];

    for (const slug of ['button', 'badge']) {
      for (const theme of ['light', 'dark']) {
        for (const viewport of ['mobile', 'tablet', 'desktop']) {
          writeFakeSnapshot(slug, theme, viewport, 'default');
        }
      }
    }

    const missing = findMissingBaselines(entries);
    expect(missing).toHaveLength(0);
  });
});

describe('findMissingBaselines — empty fixture list falls back to default', () => {
  it("treats fixtures:[] the same as fixtures:undefined — synthesises 'default'", () => {
    // An empty array means "use default fixture"
    const entries = [makeEntry('button', [])];

    // Don't write any snapshots
    const missing = findMissingBaselines(entries);
    expect(missing).toHaveLength(6);
    for (const item of missing) {
      expect(item.fixture).toBe('default');
    }
  });
});

describe('findMissingBaselines — missing entry includes expectedPath', () => {
  it('includes expectedPath in each missing entry for diagnostics', () => {
    const entries = [makeEntry('button')];
    const missing = findMissingBaselines(entries);

    for (const item of missing) {
      expect(item.expectedPath).toBeDefined();
      expect(item.expectedPath.length).toBeGreaterThan(0);
      expect(item.expectedPath).toContain('button');
    }
  });
});

// ---------------------------------------------------------------------------
// Adoption scoping
// ---------------------------------------------------------------------------

const SNAPSHOTS_DIRECTORY = join(TMP_ROOT, 'snapshots');

function writeAllDefaults(slug: string): void {
  for (const theme of ['light', 'dark']) {
    for (const viewport of ['mobile', 'tablet', 'desktop']) {
      writeFakeSnapshot(slug, theme, viewport, 'default');
    }
  }
}

describe('readBaselineFiles', () => {
  it('returns PNG file names per slug and ignores non-PNG siblings', () => {
    writeFakeSnapshot('button', 'light', 'desktop', 'default');
    writeFileSync(join(SNAPSHOTS_DIRECTORY, 'provenance.json'), '{}');

    const files = readBaselineFiles(SNAPSHOTS_DIRECTORY);
    expect([...files.keys()]).toEqual(['button']);
    expect(files.get('button')).toEqual(['light-desktop-default.png']);
  });

  it('returns an empty map when the snapshots directory does not exist', () => {
    expect(readBaselineFiles(join(TMP_ROOT, 'nope')).size).toBe(0);
  });
});

describe('evaluateBaselineCoverage — adoption scoping', () => {
  it('does not fail for slugs that have no baselines yet', () => {
    const entries = [makeEntry('button'), makeEntry('badge')];
    writeAllDefaults('button');

    const report = evaluateBaselineCoverage(entries, readBaselineFiles(SNAPSHOTS_DIRECTORY));

    expect(report.adoptedSlugs).toEqual(['button']);
    expect(report.pendingSlugs).toEqual(['badge']);
    expect(report.missing).toHaveLength(0);
    expect(report.totalSlugs).toBe(2);
  });

  it('fails an adopted slug that is only half-covered', () => {
    const entries = [makeEntry('badge', ['open', 'closed'])];
    for (const theme of ['light', 'dark']) {
      for (const viewport of ['mobile', 'tablet', 'desktop']) {
        writeFakeSnapshot('badge', theme, viewport, 'open');
      }
    }

    const report = evaluateBaselineCoverage(entries, readBaselineFiles(SNAPSHOTS_DIRECTORY));

    expect(report.adoptedSlugs).toEqual(['badge']);
    expect(report.missing).toHaveLength(6);
    for (const item of report.missing) expect(item.fixture).toBe('closed');
  });

  // Regression: `missing` used to come from findMissingBaselines(), which walks
  // only the manifest grid, while `expected` unioned in the targeted
  // combinations. The two halves disagreed about what "expected" means, so a
  // deleted targeted baseline passed this check silently and then failed late
  // and opaquely inside blockBaselineGuard in block mode.
  it('fails an adopted slug missing a baseline captured only by a targeted test', () => {
    const targeted = [
      { slug: 'badge', theme: 'light', viewport: 'desktop', fixture: 'nested-open' },
    ] as const;
    const entries = [makeEntry('badge')];
    writeAllDefaults('badge');

    const report = evaluateBaselineCoverage(
      entries,
      readBaselineFiles(SNAPSHOTS_DIRECTORY),
      targeted,
    );

    expect(report.adoptedSlugs).toEqual(['badge']);
    expect(report.missing).toHaveLength(1);
    expect(report.missing[0]?.fixture).toBe('nested-open');
    expect(report.missing[0]?.theme).toBe('light');
    expect(report.missing[0]?.viewport).toBe('desktop');
  });

  it('passes when a targeted-test baseline is present alongside the manifest grid', () => {
    const targeted = [
      { slug: 'badge', theme: 'light', viewport: 'desktop', fixture: 'nested-open' },
    ] as const;
    const entries = [makeEntry('badge')];
    writeAllDefaults('badge');
    writeFakeSnapshot('badge', 'light', 'desktop', 'nested-open');

    const report = evaluateBaselineCoverage(
      entries,
      readBaselineFiles(SNAPSHOTS_DIRECTORY),
      targeted,
    );

    expect(report.adoptedSlugs).toEqual(['badge']);
    expect(report.missing).toHaveLength(0);
  });

  it('treats a directory holding only unreachable PNGs as pending, not adopted', () => {
    // Mirrors snapshots/button/*-default.png after button's fixtures became
    // primary/danger/focused/hovered. Counting these as adoption would demand
    // 24 never-authored baselines and keep the job permanently red.
    const entries = [makeEntry('button', ['primary', 'danger'])];
    writeAllDefaults('button');

    const report = evaluateBaselineCoverage(entries, readBaselineFiles(SNAPSHOTS_DIRECTORY));

    expect(report.adoptedSlugs).toEqual([]);
    expect(report.pendingSlugs).toEqual(['button']);
    expect(report.missing).toHaveLength(0);
  });

  it('re-enforces the full grid once a slug has one recognised baseline', () => {
    const entries = [makeEntry('button', ['primary', 'danger'])];
    writeAllDefaults('button');
    writeFakeSnapshot('button', 'light', 'desktop', 'primary');

    const report = evaluateBaselineCoverage(entries, readBaselineFiles(SNAPSHOTS_DIRECTORY));

    expect(report.adoptedSlugs).toEqual(['button']);
    // 2 themes × 3 viewports × 2 fixtures = 12, minus the one written.
    expect(report.missing).toHaveLength(11);
  });

  it('reports adopted and total counts even when everything passes', () => {
    const entries = [makeEntry('button'), makeEntry('badge'), makeEntry('card')];
    writeAllDefaults('button');

    const report = evaluateBaselineCoverage(entries, readBaselineFiles(SNAPSHOTS_DIRECTORY));
    expect(report.adoptedSlugs).toHaveLength(1);
    expect(report.totalSlugs).toBe(3);
  });
});

describe('isAdoptedSlug', () => {
  it('is false when the slug has no files or no expected combinations', () => {
    expect(isAdoptedSlug(undefined, new Set(['light-desktop-default.png']))).toBe(false);
    expect(isAdoptedSlug(['light-desktop-default.png'], undefined)).toBe(false);
  });

  it('is true on the first recognised file name', () => {
    expect(
      isAdoptedSlug(
        ['stale.png', 'light-desktop-default.png'],
        new Set(['light-desktop-default.png']),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Targeted-test union / orphan detection
// ---------------------------------------------------------------------------

describe('expectedBaselineFileNames — targeted-test union', () => {
  it('includes fixture keys authored outside the component sweep', () => {
    const expected = expectedBaselineFileNames([makeEntry('mega-menu')]);
    const megaMenu = expected.get('mega-menu');

    expect(megaMenu?.has('light-desktop-default.png')).toBe(true);
    expect(megaMenu?.has('light-desktop-nested-open.png')).toBe(true);
    expect(megaMenu?.has('light-desktop-accessibility.png')).toBe(true);
  });

  it('covers targeted slugs that are absent from the supplied entries', () => {
    const expected = expectedBaselineFileNames([]);
    expect(expected.get('popover')?.has('light-desktop-transformed-ancestor-shell.png')).toBe(true);
    expect(expected.get('tooltip')?.has('light-desktop-transformed-ancestor-shell.png')).toBe(true);
  });

  it('pins the verified targeted call sites', () => {
    expect(
      TARGETED_TEST_COMBINATIONS.map(
        (combination) => `${combination.slug}:${combination.fixture}`,
      ).sort(),
    ).toEqual([
      'mega-menu:accessibility',
      'mega-menu:nested-open',
      'popover:transformed-ancestor-shell',
      'tooltip:transformed-ancestor-shell',
    ]);
  });
});

describe('findOrphanBaselines', () => {
  it('does not flag targeted-test baselines as orphans', () => {
    const entries = [makeEntry('mega-menu')];
    writeAllDefaults('mega-menu');
    writeFakeSnapshot('mega-menu', 'light', 'desktop', 'nested-open');
    writeFakeSnapshot('mega-menu', 'light', 'desktop', 'accessibility');

    const orphans = findOrphanBaselines(
      readBaselineFiles(SNAPSHOTS_DIRECTORY),
      expectedBaselineFileNames(entries),
    );

    expect(orphans).toEqual([]);
  });

  it('would flag targeted baselines if the union were derived from the manifest alone', () => {
    // Regression guard for the original bug: without the targeted union the
    // most recently authored baselines in the repo look stale.
    const entries = [makeEntry('mega-menu')];
    writeAllDefaults('mega-menu');
    writeFakeSnapshot('mega-menu', 'light', 'desktop', 'nested-open');

    const orphans = findOrphanBaselines(
      readBaselineFiles(SNAPSHOTS_DIRECTORY),
      expectedBaselineFileNames(entries, []),
    );

    expect(orphans).toEqual([{ slug: 'mega-menu', fileName: 'light-desktop-nested-open.png' }]);
  });

  it('reports unreachable fixture PNGs without touching the files', () => {
    const entries = [makeEntry('button', ['primary'])];
    writeAllDefaults('button');

    const orphans = findOrphanBaselines(
      readBaselineFiles(SNAPSHOTS_DIRECTORY),
      expectedBaselineFileNames(entries),
    );

    expect(orphans).toHaveLength(6);
    for (const orphan of orphans) {
      expect(orphan.slug).toBe('button');
      expect(orphan.fileName).toContain('-default.png');
      expect(existsSync(join(SNAPSHOTS_DIRECTORY, orphan.slug, orphan.fileName))).toBe(true);
    }
  });

  it('reports every PNG of a slug that left the manifest entirely', () => {
    writeAllDefaults('removed-component');

    const orphans = findOrphanBaselines(
      readBaselineFiles(SNAPSHOTS_DIRECTORY),
      expectedBaselineFileNames([]),
    );

    expect(orphans).toHaveLength(6);
    expect(new Set(orphans.map((orphan) => orphan.slug))).toEqual(new Set(['removed-component']));
  });
});
