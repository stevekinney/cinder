import { describe, expect, test } from 'bun:test';

import type { ArtifactKey } from './artifact-path.ts';
import { evaluateAxeGate, formatBlockingViolations } from './axe-gate.ts';
import type { AxeBuckets, AxeViolation } from './axe.ts';

const key: ArtifactKey = {
  slug: 'button',
  theme: 'light',
  viewport: 'desktop',
  fixture: 'default',
};

function violation(id: string, impact: AxeViolation['impact']): AxeViolation {
  return {
    id,
    impact,
    help: `${id} help`,
    helpUrl: `https://example.test/${id}`,
    description: `${id} description`,
    tags: ['wcag2a'],
    nodes: [{ target: ['button[data-test]'], html: '<button data-test></button>' }],
  };
}

function buckets(partial: Partial<AxeBuckets> = {}): AxeBuckets {
  return {
    critical: [],
    serious: [],
    moderate: [],
    minor: [],
    ...partial,
  };
}

describe('evaluateAxeGate', () => {
  test('passes when only non-blocking impacts are present', () => {
    expect(
      evaluateAxeGate(key, buckets({ moderate: [violation('color-contrast', 'moderate')] })),
    ).toEqual({
      status: 'pass',
    });
  });

  test('fails blocking violations without an allow-list entry', () => {
    const decision = evaluateAxeGate(
      key,
      buckets({ serious: [violation('aria-valid-attr', 'serious')] }),
    );

    expect(decision.status).toBe('fail');
    if (decision.status !== 'fail') throw new Error('Expected a failing axe gate decision.');
    expect(decision.violations.map((item) => item.id)).toEqual(['aria-valid-attr']);
    expect(decision.message).toContain(
      'button (light/desktop/default) has 1 blocking axe violation',
    );
  });

  test('allows only the documented blocking rule ids for a matching artifact', () => {
    const decision = evaluateAxeGate(
      key,
      buckets({ serious: [violation('aria-valid-attr', 'serious')] }),
      [{ slug: 'button', ruleIds: ['aria-valid-attr'], reason: 'Existing tracked issue.' }],
    );

    expect(decision).toEqual({
      status: 'allowed',
      violations: [violation('aria-valid-attr', 'serious')],
      reason: 'Existing tracked issue.',
    });
  });

  test('fails new blocking rules even when the artifact has a narrower allow-list entry', () => {
    const decision = evaluateAxeGate(
      key,
      buckets({
        serious: [violation('aria-valid-attr', 'serious'), violation('label', 'serious')],
      }),
      [
        {
          slug: 'button',
          theme: 'light',
          viewport: 'desktop',
          fixture: 'default',
          ruleIds: ['aria-valid-attr'],
          reason: 'Existing tracked issue.',
        },
      ],
    );

    expect(decision.status).toBe('fail');
    if (decision.status !== 'fail') throw new Error('Expected a failing axe gate decision.');
    expect(decision.violations.map((item) => item.id)).toEqual(['label']);
  });
});

describe('formatBlockingViolations', () => {
  test('includes artifact dimensions and the first failing selector', () => {
    expect(formatBlockingViolations(key, [violation('label', 'critical')])).toContain(
      '[critical] label: label help (https://example.test/label) at "button[data-test]"',
    );
  });
});
