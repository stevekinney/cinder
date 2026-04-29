/**
 * URL safety validation utilities for XSS prevention.
 *
 * This module provides URL validation to block dangerous protocols
 * (javascript:, vbscript:, data:, file:) while allowing safe ones
 * (http:, https:, mailto:, tel:, relative paths).
 *
 * DEP-47: Security hardening for the review editor.
 *
 * @example
 * ```typescript
 * import { isSafeUrl, sanitizeUrl } from '$lib/utilities/safe-url';
 *
 * // Validation
 * isSafeUrl('https://example.com'); // true
 * isSafeUrl('javascript:alert(1)'); // false
 *
 * // Sanitization (returns empty string for unsafe URLs)
 * sanitizeUrl('javascript:alert(1)'); // ''
 * sanitizeUrl('/path/to/resource');    // '/path/to/resource'
 * ```
 */

/**
 * Protocols that are always safe to use in URLs.
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Protocols that are always blocked (XSS vectors).
 */
const BLOCKED_PROTOCOLS = new Set(['javascript:', 'vbscript:', 'file:']);

/**
 * Data URL MIME types that are safe for image rendering.
 * Only used when allowDataImages option is enabled.
 */
const SAFE_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
  'image/bmp',
  'image/ico',
  'image/x-icon',
]);

/**
 * Options for URL validation.
 */
export interface SafeUrlOptions {
  /**
   * Allow data: URLs for images.
   * When true, data:image/* URLs with safe MIME types are permitted.
   * @default false
   */
  allowDataImages?: boolean;
}

/**
 * Check if a string starts with a relative path pattern.
 * Relative paths are considered safe.
 *
 * Recognized patterns:
 * - Absolute paths: `/path/to/resource`
 * - Current-relative: `./resource`
 * - Parent-relative: `../resource`
 * - Fragment-only: `#anchor`
 * - Query-only: `?query=value`
 */
function isRelativePath(url: string): boolean {
  // Starts with / (absolute path) but not // (protocol-relative)
  if (url.startsWith('/') && !url.startsWith('//')) return true;
  // Current-relative
  if (url.startsWith('./')) return true;
  // Parent-relative
  if (url.startsWith('../')) return true;
  // Fragment-only
  if (url.startsWith('#')) return true;
  // Query-only
  if (url.startsWith('?')) return true;

  return false;
}

/**
 * Extract and normalize the protocol from a URL string.
 * Handles various obfuscation attempts.
 *
 * @param url - The URL string to parse
 * @returns The normalized protocol (lowercase) or null if no protocol found
 */
function extractProtocol(url: string): string | null {
  // Normalize: trim whitespace, remove control characters, normalize case
  // oxlint-disable-next-line no-control-regex
  // eslint-disable-next-line no-control-regex -- intentional: stripping ASCII control characters from URLs
  const controlCharsRegex = /[\x00-\x1f\x7f]/g;
  const normalized = url
    .trim()
    // Remove ASCII control characters (0x00-0x1F, 0x7F)
    .replace(controlCharsRegex, '')
    // Remove zero-width characters and other Unicode tricks
    .replace(/[\u200b-\u200d\ufeff\u00ad]/g, '')
    // Normalize case for protocol detection
    .toLowerCase();

  // Look for protocol pattern (scheme:)
  const protocolMatch = normalized.match(/^([a-z][a-z0-9+.-]*):(?:\/\/)?/);
  if (protocolMatch) {
    return protocolMatch[1] + ':';
  }

  return null;
}

/**
 * Check if a data: URL is a safe image.
 *
 * @param url - The data URL to check
 * @returns true if the URL is a safe image data URL
 */
function isSafeDataImageUrl(url: string): boolean {
  // Normalize and check for data: prefix
  // oxlint-disable-next-line no-control-regex
  // eslint-disable-next-line no-control-regex -- intentional: stripping ASCII control characters from URLs
  const controlCharsRegex = /[\x00-\x1f\x7f]/g;
  const normalized = url
    .trim()
    .replace(controlCharsRegex, '')
    .replace(/[\u200b-\u200d\ufeff\u00ad]/g, '');

  if (!normalized.toLowerCase().startsWith('data:')) {
    return false;
  }

  // Extract MIME type (between "data:" and first ";" or ",")
  const dataContent = normalized.slice(5); // Remove "data:"
  const mimeEndIndex = Math.min(
    dataContent.indexOf(';') !== -1 ? dataContent.indexOf(';') : Infinity,
    dataContent.indexOf(',') !== -1 ? dataContent.indexOf(',') : Infinity,
  );

  if (mimeEndIndex === Infinity) {
    return false; // Malformed data URL
  }

  const mimeType = dataContent.slice(0, mimeEndIndex).toLowerCase().trim();

  return SAFE_IMAGE_MIME_TYPES.has(mimeType);
}

/**
 * Check if a URL is safe to render/navigate to.
 *
 * Safe URLs include:
 * - HTTP/HTTPS URLs
 * - mailto: and tel: links
 * - Relative paths (/, ./, ../, #, ?)
 * - Data URLs for images (when allowDataImages is true)
 *
 * Blocked URLs include:
 * - javascript: (XSS vector)
 * - vbscript: (legacy XSS vector)
 * - file: (local file access)
 * - data: (except images when allowDataImages is true)
 *
 * @param url - The URL string to validate
 * @param options - Validation options
 * @returns true if the URL is safe, false otherwise
 *
 * @example
 * ```typescript
 * isSafeUrl('https://example.com');                    // true
 * isSafeUrl('/path/to/page');                          // true
 * isSafeUrl('mailto:user@example.com');                // true
 * isSafeUrl('javascript:alert(1)');                    // false
 * isSafeUrl('data:image/png;base64,...');              // false (by default)
 * isSafeUrl('data:image/png;base64,...', { allowDataImages: true }); // true
 * ```
 */
export function isSafeUrl(url: string, options: SafeUrlOptions = {}): boolean {
  const { allowDataImages = false } = options;

  // Empty or whitespace-only URLs are not safe
  if (!url || !url.trim()) {
    return false;
  }

  // Check for relative paths first (always safe)
  if (isRelativePath(url)) {
    return true;
  }

  // Extract protocol
  const protocol = extractProtocol(url);

  // No protocol detected - could be a bare hostname or invalid
  // Treat as unsafe to be conservative
  if (!protocol) {
    // Special case: URLs like "example.com" without protocol
    // These are ambiguous and should be prefixed with https:// by the caller
    return false;
  }

  // Check if protocol is explicitly safe
  if (SAFE_PROTOCOLS.has(protocol)) {
    return true;
  }

  // Check if protocol is explicitly blocked
  if (BLOCKED_PROTOCOLS.has(protocol)) {
    return false;
  }

  // Handle data: URLs specially
  if (protocol === 'data:') {
    if (allowDataImages && isSafeDataImageUrl(url)) {
      return true;
    }
    return false;
  }

  // Unknown protocol - block by default
  return false;
}

/**
 * Sanitize a URL by returning an empty string if it's unsafe.
 *
 * Use this when you need to ensure a URL is safe before rendering.
 * Returns the original URL if safe, empty string if unsafe.
 *
 * @param url - The URL string to sanitize
 * @param options - Validation options
 * @returns The original URL if safe, empty string if unsafe
 *
 * @example
 * ```typescript
 * // In a component
 * <a href={sanitizeUrl(userProvidedUrl)}>Link</a>
 *
 * // The href will be empty (and thus inert) if the URL is unsafe
 * ```
 */
export function sanitizeUrl(url: string, options: SafeUrlOptions = {}): string {
  return isSafeUrl(url, options) ? url : '';
}

/**
 * Sanitize a URL, returning a fallback URL if the input is unsafe.
 *
 * @param url - The URL string to sanitize
 * @param fallback - The fallback URL to return if unsafe
 * @param options - Validation options
 * @returns The original URL if safe, fallback if unsafe
 *
 * @example
 * ```typescript
 * // Return '#' for unsafe URLs (stays on page)
 * <a href={sanitizeUrlWithFallback(url, '#')}>Link</a>
 *
 * // Return a safe default URL
 * const imageUrl = sanitizeUrlWithFallback(url, '/images/placeholder.png', { allowDataImages: true });
 * ```
 */
export function sanitizeUrlWithFallback(
  url: string,
  fallback: string,
  options: SafeUrlOptions = {},
): string {
  return isSafeUrl(url, options) ? url : fallback;
}
