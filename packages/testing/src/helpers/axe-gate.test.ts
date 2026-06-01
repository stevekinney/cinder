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
  it('is empty — every captured serious violation has been fixed at the source', () => {
    // The 2026-05-29 baseline sweep surfaced serious violations on charts,
    // avatar-group, progress, tag-input, code-block, copy-button, table, and
    // chip. All were fixed at the source rather than tolerated, so the gate is
    // now fully enforced: any new critical/serious violation fails CI. When a
    // genuine exception is needed, add an entry with `ruleIds` + a `reason` —
    // the invariants below keep such entries auditable.
    expect(AXE_ALLOW_LIST).toHaveLength(0);
  });

  it('gives every entry a non-empty, auditable reason', () => {
    for (const entry of AXE_ALLOW_LIST) {
      expect(entry.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it('gives every entry a non-empty list of the specific rule ids it downgrades', () => {
    for (const entry of AXE_ALLOW_LIST) {
      expect(entry.ruleIds.length).toBeGreaterThan(0);
      for (const ruleId of entry.ruleIds) {
        expect(ruleId.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('names every allow-listed rule id in the entry reason so the two stay in sync', () => {
    // The free-text reason is the human audit trail; `ruleIds` is what the gate
    // actually enforces. If they drift, the reason becomes misleading.
    for (const entry of AXE_ALLOW_LIST) {
      for (const ruleId of entry.ruleIds) {
        expect(entry.reason).toContain(ruleId);
      }
    }
  });

  it('has no duplicate slug+theme+viewport+fixture scopes', () => {
    const scopes = AXE_ALLOW_LIST.map(
      (entry) =>
        `${entry.slug}|${entry.theme ?? '*'}|${entry.viewport ?? '*'}|${entry.fixture ?? '*'}`,
    );
    expect(new Set(scopes).size).toBe(scopes.length);
  });

  it('downgrades a theme-scoped exception but still fails the same slug in an unscoped theme', () => {
    // A theme-narrowed entry tolerates the violation only in its theme; a
    // serious violation in the other theme must still fail. This keeps the
    // narrowing honest. Exercised against a synthetic list so the test does not
    // couple to the (currently empty) production allow-list.
    const allowList: AxeAllowEntry[] = [
      { slug: 'table', theme: 'light', ruleIds: ['color-contrast'], reason: 'color-contrast #42' },
    ];
    const buckets = makeBuckets({ serious: [makeViolation('color-contrast', 'serious')] });
    const lightKey: ArtifactKey = {
      slug: 'table',
      theme: 'light',
      viewport: 'desktop',
      fixture: 'default',
    };
    const darkKey: ArtifactKey = { ...lightKey, theme: 'dark' };
    expect(evaluateAxeGate(lightKey, buckets, allowList).status).toBe('allowed');
    expect(evaluateAxeGate(darkKey, buckets, allowList).status).toBe('fail');
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
    const allowList: AxeAllowEntry[] = [
      { slug: 'button', ruleIds: ['label'], reason: 'tracked in #123' },
    ];
    expect(findAllowEntry(KEY, allowList)?.reason).toBe('tracked in #123');
    expect(findAllowEntry({ ...KEY, theme: 'dark', viewport: 'mobile' }, allowList)?.reason).toBe(
      'tracked in #123',
    );
  });

  it('respects theme/viewport/fixture narrowers', () => {
    const allowList: AxeAllowEntry[] = [
      {
        slug: 'button',
        theme: 'dark',
        viewport: 'mobile',
        fixture: 'pressed',
        ruleIds: ['label'],
        reason: 'narrow',
      },
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
    const allowList: AxeAllowEntry[] = [{ slug: 'modal', ruleIds: ['label'], reason: 'tracked' }];
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

  it('downgrades to allowed when the key is allow-listed for that rule id, surfacing the reason', () => {
    const buckets = makeBuckets({ critical: [makeViolation('color-contrast', 'critical')] });
    const allowList: AxeAllowEntry[] = [
      { slug: 'button', ruleIds: ['color-contrast'], reason: 'pre-existing, tracked in #42' },
    ];
    const decision = evaluateAxeGate(KEY, buckets, allowList);
    expect(decision.status).toBe('allowed');
    if (decision.status === 'allowed') {
      expect(decision.reason).toBe('pre-existing, tracked in #42');
      expect(decision.violations).toHaveLength(1);
    }
  });

  it('fails when the slug is allow-listed but the violation rule id is not in ruleIds', () => {
    // The entry only tolerates `color-contrast`; a `label` regression on the
    // same key must still fail rather than ride along on the exception.
    const buckets = makeBuckets({ serious: [makeViolation('label', 'serious')] });
    const allowList: AxeAllowEntry[] = [
      { slug: 'button', ruleIds: ['color-contrast'], reason: 'contrast only, tracked in #42' },
    ];
    const decision = evaluateAxeGate(KEY, buckets, allowList);
    expect(decision.status).toBe('fail');
    if (decision.status === 'fail') {
      expect(decision.violations.map((violation) => violation.id)).toEqual(['label']);
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
