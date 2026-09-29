import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';
import type {
  DataAttributes,
  PadUnion,
  WithoutDataAttributes,
} from '../../_internal/union-props.ts';

export type SegmentCurrentToken = 'page' | 'step' | 'location' | 'date' | 'time' | 'true';

type SegmentOwnedAttributes =
  | 'role'
  | 'type'
  | 'disabled'
  | 'tabindex'
  | 'class'
  | 'href'
  | 'download'
  | 'target'
  | 'rel'
  | 'aria-checked'
  | 'aria-selected'
  | 'aria-pressed'
  | 'aria-controls'
  | 'aria-disabled'
  | 'aria-current'
  | 'onclick';

// COR-239: keyof Props became too complex for TypeScript to represent (TS2590) once a consumer
// type-checked this published declaration under `skipLibCheck: false` — even though both arms
// already shared the SAME `SharedElementAttributes`, that shared type still carried the `data-*`
// index signature, and the two arms otherwise differ. Fix: strip `data-*` from the shared
// attribute surface (`SharedHtmlAttributes`), restore it via a single non-distributed
// `DataAttributes` intersected once, and keep only the two arms' own differing fields inline (not
// through named types — measured to reintroduce TS2590; see `src/_internal/union-props.ts` and
// button.types.ts for the general mechanism). No prop was added, removed, widened, or narrowed —
// arbitrary `data-*` props are still accepted on every arm, exactly as before.
type SharedHtmlAttributes = WithoutDataAttributes<
  Omit<HTMLAttributes<HTMLElement>, SegmentOwnedAttributes>
>;

type SegmentDiscriminant =
  | {
      href?: undefined;
      download?: undefined;
      target?: undefined;
      rel?: undefined;
      current?: undefined;
      currentToken?: undefined;
      onclick?: undefined;
      /** Value this segment represents. Must be unique within the parent control. */
      value: string;
      /**
       * ID of the panel this segment controls — only meaningful when the parent
       * `SegmentedControl` uses `variant="tablist"`.
       */
      controls?: string | undefined;
    }
  | {
      /** Render this segment as a real link inside `SegmentedControl variant="navigation"`. */
      href: string;
      /** Download hint for the rendered link. */
      download?: boolean | string | undefined;
      /** Browsing context for the rendered link. */
      target?: HTMLAnchorAttributes['target'] | undefined;
      /** Relationship metadata for the rendered link. */
      rel?: HTMLAnchorAttributes['rel'] | undefined;
      /** Optional tab index for enabled links. Disabled navigation links force `-1`. */
      tabindex?: HTMLAttributes<HTMLElement>['tabindex'] | undefined;
      /**
       * Optional click handler for the rendered link. Disabled navigation segments
       * prevent default and do not call this handler.
       */
      onclick?: ((event: MouseEvent) => void) | undefined;
      /** Marks this linked segment as the current route/filter. */
      current?: boolean | undefined;
      /** `aria-current` token emitted while `current` is true. Defaults to `"page"`. */
      currentToken?: SegmentCurrentToken | undefined;
      /** Optional value for consumer metadata; navigation segments do not bind selection state. */
      value?: string | undefined;
      /** Panel controls apply only to tab segments, not navigation links. */
      controls?: undefined;
    };

// Attributes the component owns and computes itself, so a consumer value would be silently
// overridden. `onfocus` / `onblur` are intentionally NOT here: the component implements no
// focus handling, so forwarding them through `...rest` lets consumers wire focus-driven
// behavior (tooltips, analytics) on a segment.
export type SegmentProps = SharedHtmlAttributes &
  DataAttributes &
  PadUnion<SegmentDiscriminant> & {
    /** Custom class merged with `.cinder-segmented-control-option`. */
    class?: string | undefined;
    /** Disable just this segment (independent of the control-level `disabled`). */
    disabled?: boolean | undefined;
    /** Optional decorative content rendered before the label, inside `aria-hidden`. */
    leading?: Snippet | undefined;
    /** Optional decorative content rendered after the label, inside `aria-hidden`. */
    trailing?: Snippet | undefined;
    /** The segment's label content. */
    children: Snippet;
  };

/** Schema generator surface for Segment's cinder-specific, JSON-expressible props. */
export interface SegmentSchemaProps {
  /** Custom class merged with `.cinder-segmented-control-option`. */
  class?: string | undefined;
  /** Disable just this segment (independent of the control-level `disabled`). */
  disabled?: boolean | undefined;
  /** Render this segment as a real link inside `SegmentedControl variant="navigation"`. */
  href?: string | undefined;
  /** Marks this linked segment as the current route/filter. */
  current?: boolean | undefined;
  /** `aria-current` token emitted while `current` is true. Defaults to `"page"`. */
  currentToken?: SegmentCurrentToken | undefined;
  /** Value this segment represents. Required when `href` is not provided. */
  value?: string | undefined;
  /**
   * ID of the panel this segment controls — only meaningful when the parent
   * `SegmentedControl` uses `variant="tablist"`.
   */
  controls?: string | undefined;
}
