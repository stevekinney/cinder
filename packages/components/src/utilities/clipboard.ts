/**
 * Clipboard utility.
 *
 * Wraps `navigator.clipboard.writeText` with a defensive fallback that uses
 * the deprecated-but-still-supported `document.execCommand('copy')` path.
 * The fallback fires when:
 *
 * - `navigator.clipboard` is unavailable (older Safari, insecure contexts)
 * - The native call rejects (permissions, focus issues)
 *
 * Returns a boolean: true if any path succeeded, false otherwise. Callers
 * should reflect that to the user (e.g., flash an error icon on the button).
 */

/// <reference lib="dom" />

/**
 * Copy `text` to the clipboard. Prefers the modern Async Clipboard API and
 * falls back to a contenteditable / `execCommand('copy')` shim for older
 * browsers and edge cases.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path.
    }
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.setAttribute('tabindex', '-1');
  textarea.style.position = 'absolute';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  let succeeded = false;
  try {
    succeeded = document.execCommand('copy');
  } catch {
    succeeded = false;
  }
  textarea.remove();
  return succeeded;
}
