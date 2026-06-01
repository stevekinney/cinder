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
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyBaselineComponentFilter, findMissingBaselines } from './baseline-coverage-check.ts';

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
  fixtures?: Array<{ name: string }>;
};

function makeEntry(slug: string, fixtures?: Array<{ name: string }>): FakeEntry {
  if (fixtures !== undefined) {
    return { name: slug, slug, route: `/page/${slug}`, fixtures };
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
    const entries = [makeEntry('badge', [{ name: 'open' }, { name: 'closed' }])];

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
    const entries = [makeEntry('badge', [{ name: 'open' }, { name: 'closed' }])];

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
