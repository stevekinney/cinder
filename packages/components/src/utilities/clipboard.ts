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
      const baseRepresentations: Record<string, Blob | Promise<Blob>> = {
        'text/plain': new Blob([text], { type: 'text/plain' }),
      };
      if (rich.html !== undefined) {
        baseRepresentations['text/html'] = new Blob([rich.html], { type: 'text/html' });
      }
      const representations = { ...baseRepresentations };
      let includedImage = false;
      if (rich.image !== undefined) {
        const imageRepresentation = optionalImageRepresentation(rich.image);
        if (imageRepresentation) {
          representations[imageRepresentation.type] = imageRepresentation.value;
          includedImage = true;
        }
      }
      try {
        await navigator.clipboard.write([new ClipboardItem(representations)]);
        return true;
      } catch {
        if (includedImage && rich.html !== undefined) {
          await navigator.clipboard.write([new ClipboardItem(baseRepresentations)]);
          return true;
        }
        throw new Error('Rich clipboard write failed');
      }
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

function supportsClipboardType(type: string): boolean {
  if (!type.startsWith('image/')) return false;
  if (type === 'image/png') return true;
  return typeof ClipboardItem.supports === 'function' && ClipboardItem.supports(type);
}

function optionalImageRepresentation(
  image: Blob | string,
): { type: string; value: Blob | Promise<Blob> } | undefined {
  if (image instanceof Blob) {
    return supportsClipboardType(image.type) ? { type: image.type, value: image } : undefined;
  }
  if (!image.trim() || typeof document === 'undefined' || typeof location === 'undefined') {
    return undefined;
  }
  let resolvedUrl: URL;
  try {
    resolvedUrl = new URL(image, document.baseURI);
  } catch {
    return undefined;
  }
  const isLocallyResolvable =
    resolvedUrl.protocol === 'blob:' ||
    resolvedUrl.protocol === 'data:' ||
    resolvedUrl.origin === location.origin;
  if (!isLocallyResolvable) return undefined;

  const type = imageTypeFromUrl(resolvedUrl);
  if (!type || !supportsClipboardType(type)) return undefined;

  return {
    type,
    value: fetch(resolvedUrl).then(async (response) => {
      if (!response.ok) throw new Error(`Unable to fetch clipboard image: ${response.status}`);
      const blob = await response.blob();
      if (blob.type && blob.type !== type) {
        throw new Error(`Clipboard image type mismatch: expected ${type}, received ${blob.type}`);
      }
      return blob.type ? blob : new Blob([blob], { type });
    }),
  };
}

function imageTypeFromUrl(url: URL): string | undefined {
  if (url.protocol === 'data:') {
    return /^data:(image\/[a-z0-9.+-]+)[;,]/iu.exec(url.href)?.[1]?.toLowerCase();
  }
  if (url.protocol === 'blob:') return undefined;
  const extension = /\.([a-z0-9]+)$/iu.exec(url.pathname)?.[1]?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'webp') return 'image/webp';
  return undefined;
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
