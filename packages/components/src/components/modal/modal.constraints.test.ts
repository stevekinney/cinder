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

describe('modal constraints — chrome-conditional accessible-name rules (CIN-377)', () => {
  it('chrome="none" without aria-label violates ONLY chromeless-accessible-label, not accessible-title', () => {
    // The `accessible-title` rule's `anyOf` branch (title non-empty OR
    // chrome="none") must be satisfied by chrome="none" alone, even with no
    // title at all — the missing-name failure belongs entirely to
    // `chromeless-accessible-label`, not a double-reported `accessible-title`.
    const violations = evaluateConstraints(modalConstraints, {
      chrome: 'none',
      open: true,
      children: true,
    });
    const ruleIds = violations.map((v) => v.rule);
    expect(ruleIds).toContain('chromeless-accessible-label');
    expect(ruleIds).not.toContain('accessible-title');
  });

  it('chrome="default" (explicit) without title violates accessible-title, not chromeless-accessible-label', () => {
    const violations = evaluateConstraints(modalConstraints, {
      chrome: 'default',
      open: true,
      children: true,
    });
    const ruleIds = violations.map((v) => v.rule);
    expect(ruleIds).toContain('accessible-title');
    expect(ruleIds).not.toContain('chromeless-accessible-label');
  });

  it('chrome omitted (implicit default) without title violates accessible-title, matching explicit chrome="default"', () => {
    const violations = evaluateConstraints(modalConstraints, { open: true, children: true });
    const ruleIds = violations.map((v) => v.rule);
    expect(ruleIds).toContain('accessible-title');
  });

  it('chrome="none" with a non-empty aria-label produces zero violations even without a title', () => {
    const violations = evaluateConstraints(modalConstraints, {
      chrome: 'none',
      'aria-label': 'Image viewer',
      open: true,
      children: true,
    });
    expect(violations).toHaveLength(0);
  });
});
