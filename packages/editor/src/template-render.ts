/**
 * Secure template rendering with placeholder substitution and markdown-to-HTML conversion.
 *
 * DEP-625: This module is separated from template-placeholders.ts to avoid loading the
 * heavy @cinder/markdown rendering pipeline for consumers that only need lightweight
 * placeholder parsing/validation functions.
 *
 * @module
 */

import { renderMarkdown } from '@cinder/markdown/rendering';
import { resolveTemplatePlaceholders } from './template-placeholders.js';

/**
 * Render a template with placeholder substitution and markdown-to-HTML conversion.
 *
 * DEP-625: This function provides a secure rendering pipeline that:
 * 1. Resolves placeholders using the hardened getNestedValue() (blocks prototype pollution)
 * 2. Converts markdown to HTML using @cinder/markdown's sanitized pipeline
 * 3. Sanitizes output via rehype-sanitize (blocks XSS attacks)
 *
 * Security guarantees:
 * - Prototype pollution prevented via reserved segment blocking in getNestedValue()
 * - XSS prevented via markdown pipeline's raw HTML removal and rehype-sanitize
 * - Script tags, event handlers, and dangerous URLs are stripped (entirely removed, including content)
 * - Only safe HTML tags and attributes are allowed
 *
 * @param template - Template string with {{placeholder}} tokens
 * @param values - Data object for placeholder resolution
 * @returns Sanitized HTML string safe for rendering
 *
 * @example
 * ```typescript
 * const html = renderTemplate('# Hello {{name}}', { name: 'World' });
 * // Returns: '<h1>Hello World</h1>'
 *
 * const xss = renderTemplate('<script>alert(1)</script>{{user}}', { user: 'Alice' });
 * // Returns: '<p>Alice</p>' (script tag and its contents removed; text wrapped in a paragraph by the markdown renderer)
 * ```
 */
export function renderTemplate(template: string, values: Record<string, unknown>): string {
  // Resolve placeholders using the hardened path resolution from Phase 1
  const { text } = resolveTemplatePlaceholders(template, values);

  // Render markdown to sanitized HTML using the existing secure pipeline
  const result = renderMarkdown(text);

  return result.html;
}
