import { COLOR_DOC_SECTIONS } from './docs-section-color.ts';
import { COMPONENT_DOC_SECTIONS } from './docs-section-components.ts';
import { FOUNDATION_DOC_SECTIONS } from './docs-section-foundation.ts';

/**
 * The editorial structure for generated token documentation.
 *
 * Each semantic group owns its curation in a small module so the source stays
 * reviewable while this file preserves the generator's complete section order.
 */
export type DocSection = {
  slug: string;
  headings: readonly string[];
  cssProperties: readonly string[];
};

export { COLOR_DOC_SECTIONS, COMPONENT_DOC_SECTIONS, FOUNDATION_DOC_SECTIONS };

export const DOC_SECTIONS: readonly DocSection[] = [
  ...FOUNDATION_DOC_SECTIONS,
  ...COLOR_DOC_SECTIONS,
  ...COMPONENT_DOC_SECTIONS,
];
