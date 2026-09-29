/**
 * HTML sanitization for clipboard paste (DEP-45, DEP-47).
 *
 * This is intentionally conservative:
 * - Removes potentially dangerous tags (`script`, `iframe`, etc.)
 * - Strips event handler attributes (`on*`)
 * - Strips inline styles
 * - Blocks unsafe URL protocols (`javascript:`, `data:` by default)
 *
 * @module
 */

export interface SanitizeHtmlOptions {
  /**
   * Allowed URL protocols for href/src-like attributes.
   *
   * Defaults to: http, https, mailto, tel
   */
  allowedProtocols?: ReadonlyArray<string>;

  /**
   * Allow `data:` URLs for images.
   * Defaults to false (blocked).
   */
  allowDataUrlImages?: boolean;
}

const DEFAULT_ALLOWED_PROTOCOLS = ['http', 'https', 'mailto', 'tel'] as const;

const DISALLOWED_TAGS = ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'] as const;

/**
 * Return a safe URL value or null to indicate it should be removed.
 */
function sanitizeUrl(
  rawUrl: string,
  options: Required<SanitizeHtmlOptions>,
  element: Element,
  attributeName: string,
): string | null {
  const value = rawUrl.trim();
  if (!value) return null;

  // Allow hash and relative paths (including bare relative like "foo/bar").
  if (isRelativeUrl(value)) {
    return value;
  }

  // Detect explicit protocol (scheme:)
  const match = value.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (!match) {
    // No protocol = treat as relative URL (safe).
    return value;
  }

  const protocol = match[1]?.toLowerCase();
  if (!protocol) return '';

  // Allow specific protocols.
  if (options.allowedProtocols.includes(protocol)) {
    return value;
  }

  // Optionally allow data: URLs for <img src="data:..."> only.
  if (isAllowedDataImage(protocol, options, element, attributeName)) {
    return value;
  }

  // Block everything else (javascript:, vbscript:, file:, data: by default, etc.).
  return null;
}

function isRelativeUrl(value: string): boolean {
  return ['#', '/', './', '../'].some((prefix) => value.startsWith(prefix));
}

function isAllowedDataImage(
  protocol: string,
  options: Required<SanitizeHtmlOptions>,
  element: Element,
  attributeName: string,
): boolean {
  return (
    protocol === 'data' &&
    options.allowDataUrlImages &&
    attributeName === 'src' &&
    element.tagName.toLowerCase() === 'img'
  );
}

/**
 * Sanitize an HTML string.
 *
 * @param html - Raw clipboard HTML
 * @param options - Optional sanitization configuration
 * @returns Sanitized HTML suitable for ProseMirror DOM parsing
 */
export function sanitizeHtml(html: string, options: SanitizeHtmlOptions = {}): string {
  if (!html) return '';

  const resolvedOptions: Required<SanitizeHtmlOptions> = {
    allowedProtocols: options.allowedProtocols ?? DEFAULT_ALLOWED_PROTOCOLS,
    allowDataUrlImages: options.allowDataUrlImages ?? false,
  };

  // This is only used in the browser (clipboard paste). In non-DOM environments,
  // fail closed and return an empty string to avoid accidental unsafe passthrough.
  if (typeof DOMParser === 'undefined') {
    return '';
  }

  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');

  // Remove disallowed tags.
  for (const tag of DISALLOWED_TAGS) {
    document.querySelectorAll(tag).forEach((element) => element.remove());
  }

  // Strip unsafe attributes.
  const elements = Array.from(document.body.querySelectorAll('*'));
  for (const element of elements) {
    // Copy attributes first since we'll mutate.
    const attributes = Array.from(element.attributes);

    for (const attribute of attributes) sanitizeAttribute(element, attribute, resolvedOptions);
  }

  return document.body.innerHTML;
}

function sanitizeAttribute(
  element: Element,
  attribute: Attr,
  options: Required<SanitizeHtmlOptions>,
): void {
  const name = attribute.name.toLowerCase();
  if (name.startsWith('on') || name === 'style' || name === 'srcset') {
    element.removeAttribute(attribute.name);
    return;
  }

  if (!['href', 'src', 'xlink:href', 'formaction'].includes(name)) return;
  const sanitized = sanitizeUrl(attribute.value, options, element, name);
  if (sanitized === null) element.removeAttribute(attribute.name);
  else element.setAttribute(attribute.name, sanitized);
}
