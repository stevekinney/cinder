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

describe('modal constraints — default-chrome-rejects-aria-label (mirrors the schema fix)', () => {
  it('chrome omitted (implicit default) WITH aria-label supplied violates ONLY default-chrome-rejects-aria-label, not accessible-title', () => {
    // A valid title is present here specifically to isolate this rule: the
    // failure under test is the presence of aria-label in the default
    // chrome, not a missing title (accessible-title is covered separately
    // above).
    const violations = evaluateConstraints(modalConstraints, {
      title: 'Confirm deletion',
      'aria-label': 'Different name',
      open: true,
      children: true,
    });
    const ruleIds = violations.map((v) => v.rule);
    expect(ruleIds).toContain('default-chrome-rejects-aria-label');
    expect(ruleIds).not.toContain('accessible-title');
  });

  it('chrome="default" (explicit) WITH aria-label supplied violates default-chrome-rejects-aria-label', () => {
    const violations = evaluateConstraints(modalConstraints, {
      chrome: 'default',
      title: 'Confirm deletion',
      'aria-label': 'Different name',
      open: true,
      children: true,
    });
    const ruleIds = violations.map((v) => v.rule);
    expect(ruleIds).toContain('default-chrome-rejects-aria-label');
  });

  it('chrome="none" WITH aria-label supplied does NOT violate default-chrome-rejects-aria-label', () => {
    // Exclusivity guard: this rule must never fire for the chromeless
    // chrome, where aria-label is not just allowed but required.
    const violations = evaluateConstraints(modalConstraints, {
      chrome: 'none',
      'aria-label': 'Image viewer',
      open: true,
      children: true,
    });
    const ruleIds = violations.map((v) => v.rule);
    expect(ruleIds).not.toContain('default-chrome-rejects-aria-label');
  });

  it('default chrome WITHOUT aria-label does NOT violate default-chrome-rejects-aria-label', () => {
    // Exclusivity guard: the rule is guarded on aria-label EXISTING — it
    // must not fire at all when aria-label is simply absent (the normal,
    // expected default-chrome case).
    const violations = evaluateConstraints(modalConstraints, {
      title: 'Confirm deletion',
      open: true,
      children: true,
    });
    const ruleIds = violations.map((v) => v.rule);
    expect(ruleIds).not.toContain('default-chrome-rejects-aria-label');
  });

  it('an empty-string aria-label in the default chrome still violates default-chrome-rejects-aria-label', () => {
    // `exists: true` checks key PRESENCE, not truthiness — matching the
    // JSON Schema `required` semantics this rule mirrors (a key present
    // with any value, including '', still satisfies `required`).
    const violations = evaluateConstraints(modalConstraints, {
      title: 'Confirm deletion',
      'aria-label': '',
      open: true,
      children: true,
    });
    const ruleIds = violations.map((v) => v.rule);
    expect(ruleIds).toContain('default-chrome-rejects-aria-label');
  });
});
