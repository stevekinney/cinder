import { describe, expect, it } from 'bun:test';

import type { ArtifactKey } from './artifact-path.ts';
import {
  AXE_ALLOW_LIST,
  BLOCKING_IMPACTS,
  blockingViolations,
  evaluateAxeGate,
  findAllowEntry,
  formatBlockingViolations,
  type AxeAllowEntry,
} from './axe-gate.ts';
import type { AxeBuckets, AxeImpact, AxeViolation } from './axe.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeViolation(id: string, impact: AxeImpact): AxeViolation {
  return {
    id,
    impact,
    help: `${id} help`,
    helpUrl: `https://example.test/${id}`,
    description: `${id} description`,
    tags: ['wcag2a'],
    nodes: [{ target: ['.cinder-thing'], html: '<div class="cinder-thing"></div>' }],
  };
}

function makeBuckets(partial: Partial<Record<AxeImpact, AxeViolation[]>>): AxeBuckets {
  return {
    critical: partial.critical ?? [],
    serious: partial.serious ?? [],
    moderate: partial.moderate ?? [],
    minor: partial.minor ?? [],
  };
}

const KEY: ArtifactKey = {
  slug: 'button',
  theme: 'light',
  viewport: 'desktop',
  fixture: 'default',
};

// ---------------------------------------------------------------------------
// Policy constants
// ---------------------------------------------------------------------------

describe('BLOCKING_IMPACTS', () => {
  it('blocks critical and serious, but not moderate or minor', () => {
    expect([...BLOCKING_IMPACTS]).toEqual(['critical', 'serious']);
  });
});

describe('AXE_ALLOW_LIST', () => {
  it('documents every current pre-existing blocking violation captured by the sweep', () => {
    // The baseline captured on 2026-05-29 by running the full broad sweep
    // (134 components × 2 themes × 3 viewports) against the playground. If a
    // violation is fixed, its entry is removed here; if a new one appears, the
    // gate fails until it is fixed or added with a reason — that is the point.
    const slugs = AXE_ALLOW_LIST.map((entry) => entry.slug).toSorted();
    expect(slugs).toEqual([
      'area-chart',
      'avatar-group',
      'bar-chart',
      'chip',
      'code-block',
      'copy-button',
      'line-chart',
      'progress',
      'table',
      'tag-input',
    ]);
  });

  it('gives every entry a non-empty, auditable reason', () => {
    for (const entry of AXE_ALLOW_LIST) {
      expect(entry.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate slug+theme+viewport+fixture scopes', () => {
    const scopes = AXE_ALLOW_LIST.map(
      (entry) =>
        `${entry.slug}|${entry.theme ?? '*'}|${entry.viewport ?? '*'}|${entry.fixture ?? '*'}`,
    );
    expect(new Set(scopes).size).toBe(scopes.length);
  });

  it('scopes the theme-dependent color-contrast exceptions to their failing theme', () => {
    // color-contrast depends on the active palette, so these are narrowed to a
    // single theme rather than blanket-allowing the component.
    const table = AXE_ALLOW_LIST.find((entry) => entry.slug === 'table');
    const chip = AXE_ALLOW_LIST.find((entry) => entry.slug === 'chip');
    const copyButton = AXE_ALLOW_LIST.find((entry) => entry.slug === 'copy-button');
    expect(table?.theme).toBe('light');
    expect(chip?.theme).toBe('light');
    expect(copyButton?.theme).toBe('dark');
  });

  it('downgrades a real allow-listed violation but still fails the same slug in an unscoped theme', () => {
    // `table` is allow-listed only in the light theme; a serious violation in
    // the dark theme must still fail (this is what keeps the narrowing honest).
    const buckets = makeBuckets({ serious: [makeViolation('color-contrast', 'serious')] });
    const lightKey: ArtifactKey = {
      slug: 'table',
      theme: 'light',
      viewport: 'desktop',
      fixture: 'default',
    };
    const darkKey: ArtifactKey = { ...lightKey, theme: 'dark' };
    expect(evaluateAxeGate(lightKey, buckets, AXE_ALLOW_LIST).status).toBe('allowed');
    expect(evaluateAxeGate(darkKey, buckets, AXE_ALLOW_LIST).status).toBe('fail');
  });
});

// ---------------------------------------------------------------------------
// blockingViolations
// ---------------------------------------------------------------------------

describe('blockingViolations', () => {
  it('returns critical and serious violations only', () => {
    const buckets = makeBuckets({
      critical: [makeViolation('color-contrast', 'critical')],
      serious: [makeViolation('label', 'serious')],
      moderate: [makeViolation('region', 'moderate')],
      minor: [makeViolation('landmark', 'minor')],
    });

    const result = blockingViolations(buckets);
    expect(result.map((v) => v.id)).toEqual(['color-contrast', 'label']);
  });

  it('returns an empty list when only moderate/minor violations exist', () => {
    const buckets = makeBuckets({
      moderate: [makeViolation('region', 'moderate')],
      minor: [makeViolation('landmark', 'minor')],
    });

    expect(blockingViolations(buckets)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// findAllowEntry
// ---------------------------------------------------------------------------

describe('findAllowEntry', () => {
  it('matches a slug-only entry across every theme/viewport/fixture', () => {
    const allowList: AxeAllowEntry[] = [{ slug: 'button', reason: 'tracked in #123' }];
    expect(findAllowEntry(KEY, allowList)?.reason).toBe('tracked in #123');
    expect(findAllowEntry({ ...KEY, theme: 'dark', viewport: 'mobile' }, allowList)?.reason).toBe(
      'tracked in #123',
    );
  });

  it('respects theme/viewport/fixture narrowers', () => {
    const allowList: AxeAllowEntry[] = [
      { slug: 'button', theme: 'dark', viewport: 'mobile', fixture: 'pressed', reason: 'narrow' },
    ];
    expect(
      findAllowEntry(
        { slug: 'button', theme: 'dark', viewport: 'mobile', fixture: 'pressed' },
        allowList,
      ),
    ).toBeDefined();
    // Light theme does not match the dark-only entry.
    expect(findAllowEntry({ ...KEY, fixture: 'pressed' }, allowList)).toBeUndefined();
  });

  it('returns undefined when no entry matches the slug', () => {
    const allowList: AxeAllowEntry[] = [{ slug: 'modal', reason: 'tracked' }];
    expect(findAllowEntry(KEY, allowList)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// formatBlockingViolations
// ---------------------------------------------------------------------------

describe('formatBlockingViolations', () => {
  it('includes the key, count, rule id, impact, help, and url', () => {
    const violations = [makeViolation('color-contrast', 'critical')];
    const message = formatBlockingViolations(KEY, violations);
    expect(message).toContain('button (light/desktop/default)');
    expect(message).toContain('1 blocking axe violation');
    expect(message).toContain('[critical] color-contrast');
    expect(message).toContain('https://example.test/color-contrast');
  });
});

// ---------------------------------------------------------------------------
// evaluateAxeGate
// ---------------------------------------------------------------------------

describe('evaluateAxeGate', () => {
  it('passes when there are no blocking violations', () => {
    const buckets = makeBuckets({ moderate: [makeViolation('region', 'moderate')] });
    expect(evaluateAxeGate(KEY, buckets, []).status).toBe('pass');
  });

  it('fails when a critical violation is present and not allow-listed', () => {
    const buckets = makeBuckets({ critical: [makeViolation('color-contrast', 'critical')] });
    const decision = evaluateAxeGate(KEY, buckets, []);
    expect(decision.status).toBe('fail');
    if (decision.status === 'fail') {
      expect(decision.violations).toHaveLength(1);
      expect(decision.message).toContain('color-contrast');
    }
  });

  it('fails when a serious violation is present and not allow-listed', () => {
    const buckets = makeBuckets({ serious: [makeViolation('label', 'serious')] });
    expect(evaluateAxeGate(KEY, buckets, []).status).toBe('fail');
  });

  it('downgrades to allowed when the key is allow-listed, surfacing the reason', () => {
    const buckets = makeBuckets({ critical: [makeViolation('color-contrast', 'critical')] });
    const allowList: AxeAllowEntry[] = [{ slug: 'button', reason: 'pre-existing, tracked in #42' }];
    const decision = evaluateAxeGate(KEY, buckets, allowList);
    expect(decision.status).toBe('allowed');
    if (decision.status === 'allowed') {
      expect(decision.reason).toBe('pre-existing, tracked in #42');
      expect(decision.violations).toHaveLength(1);
    }
  });

  it('does not treat moderate/minor violations as blocking', () => {
    const buckets = makeBuckets({
      moderate: [makeViolation('region', 'moderate')],
      minor: [makeViolation('landmark', 'minor')],
    });
    expect(evaluateAxeGate(KEY, buckets, []).status).toBe('pass');
  });
});
