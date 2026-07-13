import type { Snippet } from 'svelte';

/** Props for the AccordionItem component. */
export type AccordionItemProps = {
  /** Unique identifier matched against Accordion's expandedIds. */
  id: string;
  /** Visible header label for the item. */
  title: string;
  /**
   * When true, the item cannot be toggled.
   * @default false
   */
  disabled?: boolean;
  /** Additional CSS class merged with `.cinder-accordion-item`. */
  class?: string;
  /** Inline style string applied to the `.cinder-accordion-item` root. */
  style?: string;
  /** Panel content rendered when the item is expanded. */
  children: Snippet;
};

/** Schema generator surface for AccordionItem — excludes snippet props. */
export interface AccordionItemSchemaProps {
  /** Unique identifier matched against Accordion's expandedIds. */
  id: string;
  /** Visible header label for the item. */
  title: string;
  /**
   * When true, the item cannot be toggled.
   * @default false
   */
  disabled?: boolean;
  /** Additional CSS class merged with `.cinder-accordion-item`. */
  class?: string;
  /** Inline style string applied to the `.cinder-accordion-item` root. */
  style?: string;
}
