import type { Snippet } from 'svelte';

/** Shape of the context object provided to AccordionItem children. */
export type AccordionContext = {
  readonly expandedIds: string[];
  toggle: (id: string) => void;
};

/** Props for the Accordion component. */
export type AccordionProps = {
  /**
   * When true, multiple items may be expanded simultaneously.
   * @default false
   */
  multiple?: boolean;
  /** The currently expanded item IDs. Bindable. */
  expandedIds: string[];
  /** Additional CSS class merged with `.cinder-accordion`. */
  class?: string;
  /** AccordionItem children. */
  children: Snippet;
};

/** Schema generator surface for Accordion — excludes snippet/binding props. */
export interface AccordionSchemaProps {
  /**
   * When true, multiple items may be expanded simultaneously.
   * @default false
   */
  multiple?: boolean;
  /** Additional CSS class merged with `.cinder-accordion`. */
  class?: string;
}

// Re-export the AccordionItem public type so consumers importing from
// `@lostgradient/cinder/accordion` (root barrel) can access it.
export type { AccordionItemProps } from '../accordion-item/accordion-item.types.ts';
