const MIRROR_STYLE_PROPERTIES = [
  'box-sizing',
  'width',
  'height',
  'min-height',
  'max-height',
  'border-block-start-width',
  'border-block-end-width',
  'border-inline-start-width',
  'border-inline-end-width',
  'padding-block-start',
  'padding-block-end',
  'padding-inline-start',
  'padding-inline-end',
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'font-variant',
  'line-height',
  'letter-spacing',
  'word-spacing',
  'text-indent',
  'text-transform',
  'text-align',
  'text-rendering',
  'overflow-wrap',
  'word-break',
  'word-wrap',
  'tab-size',
  'direction',
  'writing-mode',
] as const;

export function getCaretRect(
  field: HTMLInputElement | HTMLTextAreaElement | null,
  caretIndex: number,
): DOMRect | null {
  if (!field || typeof document === 'undefined' || typeof getComputedStyle === 'undefined') {
    return null;
  }

  const fieldRect = field.getBoundingClientRect();
  if (fieldRect.width === 0 || fieldRect.height === 0 || !field.isConnected) return null;

  const computedStyle = getComputedStyle(field);
  const mirror = document.createElement('div');
  const marker = document.createElement('span');
  const normalizedCaretIndex = Math.max(0, Math.min(caretIndex, field.value.length));

  mirror.setAttribute('data-cinder-command-menu-caret-mirror', '');
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.pointerEvents = 'none';
  mirror.style.whiteSpace = field instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre';
  mirror.style.overflow = computedStyle.overflow;
  mirror.style.left = `${fieldRect.left + window.scrollX}px`;
  mirror.style.top = `${fieldRect.top + window.scrollY}px`;

  for (const property of MIRROR_STYLE_PROPERTIES) {
    mirror.style.setProperty(property, computedStyle.getPropertyValue(property));
  }

  mirror.textContent = field.value.slice(0, normalizedCaretIndex);
  marker.textContent = '\u200b';
  mirror.append(marker);
  document.body.append(mirror);
  mirror.scrollLeft = field.scrollLeft;
  mirror.scrollTop = field.scrollTop;

  const markerRect = marker.getBoundingClientRect();
  const rect = new DOMRect(
    markerRect.left,
    markerRect.top,
    Math.max(markerRect.width, 1),
    Math.max(markerRect.height, Number.parseFloat(computedStyle.lineHeight) || 16),
  );

  mirror.remove();
  return rect;
}
