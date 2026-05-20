import { describe, expect, it } from 'bun:test';

import { evaluateConstraints } from '../../_internal/constraints.ts';
import { invalid, valid } from './input.constraints.fixtures.ts';
import inputConstraints from './input.constraints.ts';

describe('input constraints — valid fixtures', () => {
  for (const attributes of valid) {
    it(`produces zero violations for: ${JSON.stringify(attributes)}`, () => {
      const violations = evaluateConstraints(inputConstraints, attributes);
      expect(violations).toHaveLength(0);
    });
  }
});

describe('input constraints — invalid fixtures', () => {
  for (const { attributes, violates } of invalid) {
    it(`produces a violation containing rule "${violates}" for: ${JSON.stringify(attributes)}`, () => {
      const violations = evaluateConstraints(inputConstraints, attributes);
      const ruleIds = violations.map((v) => v.rule);
      expect(ruleIds).toContain(violates);
    });
  }
});
