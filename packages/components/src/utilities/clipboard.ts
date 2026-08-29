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
export async function copyToClipboard(
  text: string,
  rich: { html?: string; image?: Blob | string } = {},
): Promise<boolean> {
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard?.write &&
    typeof ClipboardItem !== 'undefined' &&
    (rich.html !== undefined || rich.image !== undefined)
  ) {
    try {
      const representations: Record<string, Blob> = {
        'text/plain': new Blob([text], { type: 'text/plain' }),
      };
      if (rich.html !== undefined) {
        representations['text/html'] = new Blob([rich.html], { type: 'text/html' });
      }
      if (rich.image !== undefined) {
        const imageBlob = await resolveOptionalImage(rich.image);
        if (imageBlob?.type.startsWith('image/')) representations[imageBlob.type] = imageBlob;
      }
      await navigator.clipboard.write([new ClipboardItem(representations)]);
      return true;
    } catch {
      // Fall through to writeText and finally the legacy selection path.
    }
  }
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

async function resolveOptionalImage(image: Blob | string): Promise<Blob | undefined> {
  if (image instanceof Blob) return image;
  const resolvedUrl = new URL(image, document.baseURI);
  const isLocallyResolvable =
    resolvedUrl.protocol === 'blob:' ||
    resolvedUrl.protocol === 'data:' ||
    resolvedUrl.origin === globalThis.location.origin;
  if (!isLocallyResolvable) return undefined;
  try {
    const response = await fetch(resolvedUrl);
    if (!response.ok) return undefined;
    return await response.blob();
  } catch {
    return undefined;
  }
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
