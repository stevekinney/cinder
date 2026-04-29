/**
 * URL sanitization transform for mdast.
 *
 * DEP-49: Sanitize URLs during mdast traversal before conversion to hast.
 *
 * This integrates with the existing `src/lib/utilities/safe-url.ts` utilities
 * to catch dangerous URLs at the source level.
 *
 * @module
 */

import type { Definition, Image, Link, Root } from 'mdast';
import { visit } from 'unist-util-visit';
import { isSafeUrl, type SafeUrlOptions } from '../utilities/safe-url.js';

/**
 * Result of URL sanitization transform.
 */
export interface TransformUrlsResult {
  /** The transformed AST (mutated in place) */
  root: Root;
  /** Whether any unsafe URLs were encountered */
  hadUnsafeUrls: boolean;
}

/**
 * Sanitize URLs in link, image, and definition nodes.
 *
 * - For unsafe links: replaces URL with `#` (link becomes inert)
 * - For unsafe images: replaces URL with `''` (shows alt text only)
 * - For unsafe definitions: replaces URL with `#` (reference-style links become inert)
 *
 * Definition nodes are used for reference-style links like `[text][ref]` with
 * `[ref]: javascript:alert(1)`. These must be sanitized at the mdast level
 * to correctly set the hadUnsafeUrls flag.
 *
 * @param root - mdast Root node
 * @param options - URL validation options
 * @returns Transform result with hadUnsafeUrls flag
 */
export function transformUrls(root: Root, options: SafeUrlOptions = {}): TransformUrlsResult {
  let hadUnsafeUrls = false;

  visit(root, 'link', (node: Link) => {
    if (!isSafeUrl(node.url, options)) {
      node.url = '#';
      hadUnsafeUrls = true;
    }
  });

  visit(root, 'image', (node: Image) => {
    if (!isSafeUrl(node.url, options)) {
      node.url = '';
      hadUnsafeUrls = true;
    }
  });

  // Handle reference-style links: [text][ref] with [ref]: url
  // The URL is stored in a definition node, not the link node itself
  visit(root, 'definition', (node: Definition) => {
    if (!isSafeUrl(node.url, options)) {
      node.url = '#';
      hadUnsafeUrls = true;
    }
  });

  return { root, hadUnsafeUrls };
}
