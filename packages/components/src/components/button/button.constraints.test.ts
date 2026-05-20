import { describe, expect, it } from 'bun:test';

import { evaluateConstraints } from '../../_internal/constraints.ts';
import { invalid, valid } from './button.constraints.fixtures.ts';
import buttonConstraints from './button.constraints.ts';

describe('button constraints — valid fixtures', () => {
  for (const attributes of valid) {
    it(`produces zero violations for: ${JSON.stringify(attributes)}`, () => {
      const violations = evaluateConstraints(buttonConstraints, attributes);
      expect(violations).toHaveLength(0);
    });
  }
});

describe('button constraints — invalid fixtures', () => {
  for (const { attributes, violates } of invalid) {
    it(`produces a violation containing rule "${violates}" for: ${JSON.stringify(attributes)}`, () => {
      const violations = evaluateConstraints(buttonConstraints, attributes);
      const ruleIds = violations.map((v) => v.rule);
      expect(ruleIds).toContain(violates);
    });
  }
});
