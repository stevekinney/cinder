/**
 * Plain-TS support module for the message parts renderer.
 *
 * Types and the pure `toRenderUnits` grouping live here (not in the `.svelte`
 * file) so they are importable under plain `tsc`/`svelte-check` — symbols
 * exported from a `.svelte` `<script module>` are not reliably resolvable
 * outside the Svelte language service.
 */

import type { Snippet } from 'svelte';

import type {
  ChatMessagePart,
  ImageMessagePart,
  StepMessagePart,
  SuggestionMessagePart,
} from '../utilities/types.ts';

/**
 * A body part — every renderable part EXCEPT image, step, and suggestion.
 * Image parts render through the grouped attachment path (the grid lays out
 * by total count). Step parts are grouped into the stepper render unit and
 * bypass the per-part override entirely — they never reach `messagePart` or
 * `renderDefault`. Suggestion parts render through the grouped `suggestions`
 * toolbar path so all chips appear inside a single `role="toolbar"` wrapper.
 * None of these flow through the per-part override; the override's type
 * excludes them so a consumer can't write dead branches for them.
 */
export type BodyMessagePart = Exclude<
  ChatMessagePart,
  ImageMessagePart | StepMessagePart | SuggestionMessagePart
>;

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
   * tool-result, tool-approval, reasoning). Image parts, step parts, and
   * suggestion parts always render through the grouped default paths; they are
   * excluded from this override's type and never flow through it. In
   * particular, step parts are accumulated into the stepper render unit and
   * bypass this override entirely — a consumer cannot intercept individual
   * step parts via `messagePart`.
   */
  messagePart?: MessagePartOverride | undefined;
  /** Disclosure state for tool-call parts. Owned by the message. */
  expanded?: boolean;
  /** Called when a tool-call part's disclosure toggle is activated. */
  ontoggle?: (() => void) | undefined;
  /** Called when the user approves an action-required tool call. */
  onapprove?: ((toolCallId: string) => void) | undefined;
  /** Called when the user denies an action-required tool call. */
  ondeny?: ((toolCallId: string) => void) | undefined;
  /** Whether the reasoning block for this message is expanded. */
  reasoningExpanded?: boolean | undefined;
  /** Called when the reasoning disclosure toggle is activated. */
  onreasoning?: (() => void) | undefined;
  /** Called when the user selects a suggestion chip. */
  onsuggestionselect?: ((label: string) => void) | undefined;
};

/** A renderable unit: a single body part, a contiguous run of image parts, a group of step parts, or a group of suggestion chips. */
export type RenderUnit =
  | {
      kind: 'part';
      part: Exclude<ChatMessagePart, ImageMessagePart | StepMessagePart | SuggestionMessagePart>;
      key: string;
    }
  | { kind: 'images'; images: ImageMessagePart[]; key: string }
  | { kind: 'steps'; steps: StepMessagePart[]; key: string }
  | { kind: 'suggestions'; suggestions: SuggestionMessagePart[]; key: string };

/**
 * Collapses a parts array into render units, grouping each maximal run of
 * adjacent image parts into one unit, each maximal run of adjacent step parts
 * into one stepper unit, and each maximal run of adjacent suggestion parts into
 * one toolbar unit. Keeps non-image, non-step, non-suggestion parts individual
 * so the per-part override applies to them; groups images so the attachment
 * grid lays out by total count; groups steps so they render inside a single
 * `<ol>`; groups suggestions so they render inside a single `role="toolbar"`.
 *
 * @param parts - The ordered render parts for one message
 * @returns Render units in order, with image, step, and suggestion runs collapsed
 */
export function toRenderUnits(parts: ChatMessagePart[]): RenderUnit[] {
  const units: RenderUnit[] = [];
  let imageRun: ImageMessagePart[] = [];
  let stepRun: StepMessagePart[] = [];
  let suggestionRun: SuggestionMessagePart[] = [];

  const flushImages = (): void => {
    if (imageRun.length > 0) {
      // The run's key is its first image key — stable as long as the run's
      // leading image keeps identity, which it does (index-based keys).
      units.push({ kind: 'images', images: imageRun, key: `images:${imageRun[0]!.key}` });
      imageRun = [];
    }
  };

  const flushSteps = (): void => {
    if (stepRun.length > 0) {
      units.push({ kind: 'steps', steps: stepRun, key: `steps:${stepRun[0]!.key}` });
      stepRun = [];
    }
  };

  const flushSuggestions = (): void => {
    if (suggestionRun.length > 0) {
      units.push({
        kind: 'suggestions',
        suggestions: suggestionRun,
        key: `suggestions:${suggestionRun[0]!.key}`,
      });
      suggestionRun = [];
    }
  };

  for (const part of parts) {
    if (part.type === 'image') {
      flushSteps();
      flushSuggestions();
      imageRun.push(part);
      continue;
    }
    if (part.type === 'step') {
      flushImages();
      flushSuggestions();
      stepRun.push(part);
      continue;
    }
    if (part.type === 'suggestion') {
      flushImages();
      flushSteps();
      suggestionRun.push(part);
      continue;
    }
    flushImages();
    flushSteps();
    flushSuggestions();
    units.push({ kind: 'part', part, key: part.key });
  }
  flushImages();
  flushSteps();
  flushSuggestions();
  return units;
}
