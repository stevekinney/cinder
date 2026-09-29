/**
 * Measure where a caret offset sits inside a textarea.
 *
 * A textarea exposes no geometry for its text, so a hidden measurement
 * element mirrors the textarea's font, line height, padding, white-space and
 * wrapping at the textarea's content width (excluding any scrollbar). The
 * marker after the text up to the caret gives the caret's position inside
 * the content, which is then shifted by the textarea's own position, border
 * and scroll offsets. The same approach backs Cinder's command menu.
 */

const MIRRORED_PROPERTIES = [
  'direction',
  'font-family',
  'font-feature-settings',
  'font-kerning',
  'font-size',
  'font-stretch',
  'font-style',
  'font-variant',
  'font-weight',
  'letter-spacing',
  'line-height',
  'overflow-wrap',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'tab-size',
  'text-align',
  'text-indent',
  'text-rendering',
  'text-transform',
  'white-space',
  'word-break',
  'word-spacing',
  'word-wrap',
  'writing-mode',
] as const;

/** A caret rectangle in viewport coordinates. */
export interface CaretRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

function pixels(value: string): number {
  return Number.parseFloat(value) || 0;
}

/** Owns one textarea's measurement element; `destroy` removes it. */
export class SourceCaretMeasurer {
  readonly #textarea: HTMLTextAreaElement;
  #mirror: HTMLDivElement | null = null;

  constructor(textarea: HTMLTextAreaElement) {
    this.#textarea = textarea;
  }

  /** The viewport rectangle of a collapsed caret at `offset`. */
  measure(offset: number): CaretRect {
    const textarea = this.#textarea;
    const style = getComputedStyle(textarea);
    const mirror = this.#ensureMirror();
    for (const property of MIRRORED_PROPERTIES) {
      mirror.style.setProperty(property, style.getPropertyValue(property));
    }
    mirror.style.width = `${textarea.clientWidth}px`;

    const caret = Math.max(0, Math.min(offset, textarea.value.length));
    const marker = mirror.ownerDocument.createElement('span');
    marker.textContent = '​';
    mirror.replaceChildren(textarea.value.slice(0, caret), marker);

    const mirrorRect = mirror.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const textareaRect = textarea.getBoundingClientRect();
    const left =
      textareaRect.left +
      pixels(style.borderLeftWidth) +
      (markerRect.left - mirrorRect.left) -
      textarea.scrollLeft;
    const top =
      textareaRect.top +
      pixels(style.borderTopWidth) +
      (markerRect.top - mirrorRect.top) -
      textarea.scrollTop;
    const height = pixels(style.lineHeight) || markerRect.height;
    return { x: left, y: top, width: 0, height, top, right: left, bottom: top + height, left };
  }

  /** Remove the measurement element. */
  destroy(): void {
    this.#mirror?.remove();
    this.#mirror = null;
  }

  #ensureMirror(): HTMLDivElement {
    if (this.#mirror?.isConnected) return this.#mirror;
    const document = this.#textarea.ownerDocument;
    const mirror = document.createElement('div');
    mirror.setAttribute('aria-hidden', 'true');
    mirror.dataset['markdownEditorCaretMirror'] = '';
    Object.assign(mirror.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      visibility: 'hidden',
      pointerEvents: 'none',
      overflow: 'hidden',
      boxSizing: 'border-box',
      border: '0',
      margin: '0',
      height: 'auto',
    });
    document.body.append(mirror);
    this.#mirror = mirror;
    return mirror;
  }
}
