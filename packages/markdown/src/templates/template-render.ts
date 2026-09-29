/**
 * Secure template rendering with placeholder substitution and markdown-to-HTML conversion.
 *
 * DEP-625: This module is separated from template-placeholders.ts to avoid loading the
 * heavy @lostgradient/markdown rendering pipeline for consumers that only need lightweight
 * placeholder parsing/validation functions.
 *
 * @module
 */

import { renderMarkdown } from '../rendering/index.js';
import { resolveTemplatePlaceholders } from './template-placeholders.js';
import type { JsonObject, PlaceholderResolutionOptions } from './types.js';

/**
 * Render a template with placeholder substitution and markdown-to-HTML conversion.
 *
 * DEP-625: This function provides a secure rendering pipeline that:
 * 1. Resolves declared placeholders with `resolveTemplatePlaceholders` and the same options
 * 2. Converts markdown to HTML using @lostgradient/markdown's sanitized pipeline
 * 3. Sanitizes output via rehype-sanitize (blocks XSS attacks)
 *
 * Security guarantees:
 * - Prototype pollution prevented: only declared own data properties resolve and reserved segments are blocked
 * - XSS prevented via markdown pipeline's raw HTML removal and rehype-sanitize
 * - Script tags, event handlers, and dangerous URLs are stripped (entirely removed, including content)
 * - Only safe HTML tags and attributes are allowed
 *
 * @param template - Template string with {{placeholder}} tokens
 * @param values - Data object for placeholder resolution
 * @param options - Required `definitions`, plus optional `valueMode` and `unresolved`, forwarded to `resolveTemplatePlaceholders`
 * @returns Sanitized HTML string safe for rendering
 * @throws {PlaceholderTemplateError} When `unresolved` is `'error'` and resolution finds any issue
 *
 * @example
 * ```typescript
 * const definitions = { candidates: [{ path: 'name', types: ['string'] }] } as const;
 * const html = renderTemplate('# Hello {{name}}', { name: 'World' }, { definitions });
 * // Returns: '<h1>Hello World</h1>'
 * ```
 */
export function renderTemplate(
  template: string,
  values: JsonObject,
  options: PlaceholderResolutionOptions,
): string {
  const { text } = resolveTemplatePlaceholders(template, values, options);

  // Render markdown to sanitized HTML using the existing secure pipeline
  const result = renderMarkdown(text);

  return result.html;
}
