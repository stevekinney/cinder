import type { ComponentAttributes } from '../../_internal/constraints.ts';

/**
 * Valid attribute sets for the PricingCard component.
 * Each must produce zero violations.
 */
export const valid: ComponentAttributes[] = [
  // Button CTA — no href, onPlanSelect present.
  { onPlanSelect: () => {} },

  // Link CTA — href only, no onPlanSelect.
  { href: '/checkout' },

  // Link CTA — href with target/rel.
  { href: '/checkout', target: '_blank', rel: 'noopener noreferrer' },

  // Link CTA — href and onPlanSelect both present (analytics side effect).
  { href: '/checkout', onPlanSelect: () => {} },

  // Link CTA — href, onPlanSelect, target, and rel all present.
  { href: '/checkout', onPlanSelect: () => {}, target: '_blank', rel: 'noopener noreferrer' },
];

/**
 * Invalid attribute sets for the PricingCard component.
 */
export const invalid: Array<{ attributes: ComponentAttributes; violates: string }> = [
  // violates: cta-activation-source — neither href nor onPlanSelect provided.
  {
    attributes: {},
    violates: 'cta-activation-source',
  },

  // violates: anchor-only-attributes-need-href — target without href.
  {
    attributes: { onPlanSelect: () => {}, target: '_blank' },
    violates: 'anchor-only-attributes-need-href',
  },

  // violates: anchor-only-attributes-need-href — rel without href.
  {
    attributes: { onPlanSelect: () => {}, rel: 'noopener noreferrer' },
    violates: 'anchor-only-attributes-need-href',
  },
];
