/**
 * Sanitization schema for rehype-sanitize.
 *
 * DEP-49: SSR-safe HTML sanitization for chat markdown rendering.
 *
 * This schema matches the behavior of `src/lib/editor/sanitize-html.ts`
 * but operates on the hast AST instead of using DOMParser, making it SSR-safe.
 *
 * @module
 */

import type { Schema } from 'hast-util-sanitize';
import { defaultSchema } from 'hast-util-sanitize';

/**
 * Protocols allowed in href/src attributes.
 */
const ALLOWED_PROTOCOLS = ['http', 'https', 'mailto', 'tel'];

/**
 * Tags that are explicitly blocked (dangerous for XSS).
 */
const BLOCKED_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'];

/**
 * MathML element names produced by KaTeX's MathML output layer.
 *
 * KaTeX renders math in two passes: an HTML pass (for visual layout) and a
 * MathML pass (for accessibility/screen readers). Both must be allowed through
 * sanitization or the output will be stripped.
 */
const KATEX_MATHML_TAGS = [
  'math',
  'semantics',
  'mrow',
  'mi',
  'mo',
  'mn',
  'msup',
  'msub',
  'mfrac',
  'mtext',
  'annotation',
  'mover',
  'munder',
  'munderover',
  'msqrt',
  'mroot',
  'mpadded',
  'mphantom',
  'mtable',
  'mtr',
  'mtd',
  'mspace',
];

/**
 * Create a sanitization schema for rehype-sanitize.
 *
 * @param options - Configuration options
 * @returns Schema compatible with rehype-sanitize
 */
export function createSanitizeSchema(options: { allowDataImages?: boolean } = {}): Schema {
  const { allowDataImages = false } = options;

  // Build protocol list for images (optionally include data:)
  const imageProtocols = allowDataImages ? [...ALLOWED_PROTOCOLS, 'data'] : ALLOWED_PROTOCOLS;

  return {
    ...defaultSchema,
    // Explicitly block dangerous tags, and add KaTeX MathML elements
    tagNames: [
      ...(defaultSchema.tagNames ?? []).filter((tag) => !BLOCKED_TAGS.includes(tag)),
      ...KATEX_MATHML_TAGS,
    ],
    // Strip all attributes by default, then allowlist specific ones
    attributes: {
      ...defaultSchema.attributes,
      // Allow class for styling (used by code blocks and KaTeX spans)
      '*': ['className'],
      // Links: allow href with safe protocols
      // Note: target/rel intentionally omitted to prevent tabnapping attacks
      a: ['href', 'title'],
      // Images: allow src with safe protocols (optionally data:)
      img: ['src', 'alt', 'title', 'width', 'height'],
      // Code blocks: allow language class, style (for Shiki highlighting), and data-language
      // Note: style is limited to Shiki's color/background-color output by the highlighter
      code: ['className', 'style'],
      pre: ['className', 'style', 'dataLanguage', 'tabIndex'],
      // Spans: allow style for Shiki token colors and KaTeX sizing/spacing
      span: ['className', 'style'],
      // Tables
      table: ['className'],
      th: ['align', 'valign', 'scope'],
      td: ['align', 'valign'],
      // KaTeX MathML: math element needs xmlns for proper MathML rendering
      math: ['xmlns', 'display'],
      // KaTeX MathML: annotation carries the original LaTeX source for copy/accessibility
      annotation: ['encoding'],
    },
    // Protocol allowlists
    protocols: {
      href: ALLOWED_PROTOCOLS,
      src: imageProtocols,
    },
    // Strip dangerous tags entirely
    strip: BLOCKED_TAGS,
  };
}

/**
 * Default sanitization schema (no data: URLs for images).
 */
export const sanitizeSchema: Schema = createSanitizeSchema();
