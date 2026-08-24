import { describe, expect, it } from 'bun:test';

import type { ComponentAttributes } from '../../_internal/constraints.ts';
import { evaluateConstraints } from '../../_internal/constraints.ts';
import { invalid, valid } from './pricing-card.constraints.fixtures.ts';
import pricingCardConstraints from './pricing-card.constraints.ts';

/**
 * `JSON.stringify` silently drops function-valued properties, so two fixtures
 * that differ only in an `onPlanSelect` callback (e.g. `{ href: '/x' }` vs.
 * `{ href: '/x', onPlanSelect: () => {} }`) stringify to different text but a
 * fixture whose *only* property is a function (e.g. `{ onPlanSelect: () => {} }`)
 * stringifies to `"{}"` and collides with a genuinely empty fixture. Render
 * function values as an explicit token so every fixture gets a distinct,
 * readable test name.
 */
function describeAttributes(attributes: ComponentAttributes): string {
  return JSON.stringify(attributes, (_key, value) =>
    typeof value === 'function' ? '[function]' : value,
  );
}

describe('pricing-card constraints — valid fixtures', () => {
  for (const attributes of valid) {
    it(`produces zero violations for: ${describeAttributes(attributes)}`, () => {
      const violations = evaluateConstraints(pricingCardConstraints, attributes);
      expect(violations).toHaveLength(0);
    });
  }
});

describe('pricing-card constraints — invalid fixtures', () => {
  for (const { attributes, violates } of invalid) {
    it(`produces a violation containing rule "${violates}" for: ${describeAttributes(attributes)}`, () => {
      const violations = evaluateConstraints(pricingCardConstraints, attributes);
      const ruleIds = violations.map((v) => v.rule);
      expect(ruleIds).toContain(violates);
    });
  }
});
