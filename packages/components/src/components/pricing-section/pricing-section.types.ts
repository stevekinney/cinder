import type { HTMLAttributes } from 'svelte/elements';
import type { ContainerMaxWidth } from '../container/container.types.ts';

/** @schemaObject */
export type PricingSectionPlan = {
  /** Plan name. */
  name: string;
  /** Plan price label. */
  price: string;
  /** Included features. */
  features: string[];
  /** CTA label for the plan action button. */
  cta: string;
  /** Optional caveat text. */
  caveat?: string;
  /** Marks plan as highlighted/selected. */
  selected?: boolean;
};

/** Props for the PricingSection component. */
export type PricingSectionProps = Omit<HTMLAttributes<HTMLElement>, 'children' | 'class'> & {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Optional section title. */
  title?: string;
  /** Optional section description. */
  description?: string;
  /** Plans rendered as PricingCard components. */
  plans: PricingSectionPlan[];
  /** Grid column count. @default 3 */
  columns?: 1 | 2 | 3 | 4;
  /** Callback fired when a plan CTA is clicked. */
  onPlanSelect?: (plan: PricingSectionPlan, index: number) => void;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-pricing-section`. */
  class?: string;
};

export interface PricingSectionSchemaProps {
  /** Wrapper element tag. @default "section" */
  as?: 'section' | 'div';
  /** Optional section title. */
  title?: string;
  /** Optional section description. */
  description?: string;
  /** Plans rendered as PricingCard components. */
  plans: PricingSectionPlan[];
  /** Grid column count. @default 3 */
  columns?: 1 | 2 | 3 | 4;
  /** Max width token forwarded to Container. @default "wide" */
  maxWidth?: ContainerMaxWidth;
  /** Custom class merged with `.cinder-pricing-section`. */
  class?: string;
}
