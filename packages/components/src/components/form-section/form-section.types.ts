import type { Snippet } from 'svelte';
export type FormSectionHeadingLevel = 2 | 3 | 4 | 5 | 6;
type FormSectionSharedProps = {
  /** Optional descriptive paragraph rendered under the heading/legend. */
  description?: string;
  /** Column ceiling. Container queries pick the actual rendered count. Default 2. */
  columns?: 1 | 2 | 3 | 4;
  /** Additional class merged with `.cinder-form-section`. */
  class?: string;
  /** Children (FormField instances or arbitrary content). */
  children: Snippet;
};
/**
 * Discriminated union: `as="fieldset"` requires `heading` (a legend-less fieldset
 * has no accessible group name). `as="section"` (default) treats heading as optional.
 * This makes the inaccessible state unrepresentable in TypeScript.
 */
export type FormSectionProps =
  | (FormSectionSharedProps & {
      /** Wrapper element. Default. */
      as?: 'section';
      /** Heading text rendered as `<h{level}>`. */
      heading?: string;
      /** Heading level. Default 2. */
      headingLevel?: FormSectionHeadingLevel;
    })
  | (FormSectionSharedProps & {
      /** Wrapper element. Use for grouped related inputs. */
      as: 'fieldset';
      /** Required heading — rendered as `<legend>`. */
      heading: string;
      /** Ignored for fieldset (legend is the only heading). */
      headingLevel?: never;
    });
