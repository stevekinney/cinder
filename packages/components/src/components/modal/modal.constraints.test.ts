import { describe, expect, it } from 'bun:test';

import { evaluateConstraints } from '../../_internal/constraints.ts';
import { invalid, valid } from './modal.constraints.fixtures.ts';
import modalConstraints from './modal.constraints.ts';

describe('modal constraints — valid fixtures', () => {
  for (const attributes of valid) {
    it(`produces zero violations for: ${JSON.stringify(attributes)}`, () => {
      const violations = evaluateConstraints(modalConstraints, attributes);
      expect(violations).toHaveLength(0);
    });
  }
});

describe('modal constraints — invalid fixtures', () => {
  for (const { attributes, violates } of invalid) {
    it(`produces a violation containing rule "${violates}" for: ${JSON.stringify(attributes)}`, () => {
      const violations = evaluateConstraints(modalConstraints, attributes);
      const ruleIds = violations.map((v) => v.rule);
      expect(ruleIds).toContain(violates);
    });
  }
});
