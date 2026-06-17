/**
 * Plain-TS support module for the message parts renderer.
 *
 * Types and the pure `toRenderUnits` grouping live here (not in the `.svelte`
 * file) so they are importable under plain `tsc`/`svelte-check` — symbols
 * exported from a `.svelte` `<script module>` are not reliably resolvable
 * outside the Svelte language service.
 */

import type { Snippet } from 'svelte';

import type { ChatMessagePart, ImageMessagePart } from '../utilities/types.ts';

/**
 * A body part — every renderable part EXCEPT image. Image parts render through
 * the grouped attachment path (the grid lays out by total count), so they never
 * flow through the per-part override; the override's type excludes them so a
 * consumer can't write a dead `part.type === 'image'` branch.
 */
export type BodyMessagePart = Exclude<ChatMessagePart, ImageMessagePart>;

/**
 * Per-part override snippet. Inversion of control: the consumer receives the
 * part AND a `renderDefault` snippet, and decides whether to render its own
 * markup or delegate to the built-in renderer by calling
 * `{@render renderDefault(part)}`. There is no "render empty to fall through"
 * magic — Svelte snippets render DOM and have no inspectable return value, so
 * the fallback is always explicit and SSR-safe.
 *
 * The part is a {@link BodyMessagePart} (image parts are excluded — see above),
 * so the type matches what the override can actually intercept.
 */
export type MessagePartOverride = Snippet<
  [part: BodyMessagePart, renderDefault: Snippet<[BodyMessagePart]>]
>;

/** Props for {@link ChatMessagePartsRenderer}. */
export type ChatMessagePartsRendererProps = {
  /** The ordered render parts for one message. */
  parts: ChatMessagePart[];
  /**
   * Optional per-part override. Applies to body parts (markdown, tool-call,
   * tool-result). Image parts always render through the grouped default path so
   * the attachment grid lays out by total count; they are excluded from this
   * override's type and never flow through it.
   */
  messagePart?: MessagePartOverride | undefined;
  /** Disclosure state for tool-call parts. Owned by the message. */
  expanded?: boolean;
  /** Called when a tool-call part's disclosure toggle is activated. */
  ontoggle?: (() => void) | undefined;
};

/** A renderable unit: a single body part, or a contiguous run of image parts. */
export type RenderUnit =
  | { kind: 'part'; part: Exclude<ChatMessagePart, ImageMessagePart>; key: string }
  | { kind: 'images'; images: ImageMessagePart[]; key: string };

/**
 * Collapses a parts array into render units, grouping each maximal run of
 * adjacent image parts into one unit. Keeps non-image parts individual so the
 * per-part override applies to them; groups images so the attachment grid
 * still lays out by total count.
 *
 * @param parts - The ordered render parts for one message
 * @returns Render units in order, with image runs collapsed
 */
export function toRenderUnits(parts: ChatMessagePart[]): RenderUnit[] {
  const units: RenderUnit[] = [];
  let imageRun: ImageMessagePart[] = [];

  const flushImages = (): void => {
    if (imageRun.length > 0) {
      // The run's key is its first image key — stable as long as the run's
      // leading image keeps identity, which it does (index-based keys).
      units.push({ kind: 'images', images: imageRun, key: `images:${imageRun[0]!.key}` });
      imageRun = [];
    }
  };

  for (const part of parts) {
    if (part.type === 'image') {
      imageRun.push(part);
      continue;
    }
    flushImages();
    units.push({ kind: 'part', part, key: part.key });
  }
  flushImages();
  return units;
}
