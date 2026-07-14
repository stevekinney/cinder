import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes } from 'svelte/elements';

export type SegmentCurrentToken = 'page' | 'step' | 'location' | 'date' | 'time' | 'true';

// Attributes the component owns and computes itself, so a consumer value would
// be silently overridden. `onfocus` / `onblur` are intentionally NOT here: the
// component implements no focus handling, so forwarding them through `...rest`
// lets consumers wire focus-driven behavior (tooltips, analytics) on a segment.
type SharedProps = {
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

type SharedElementAttributes = Omit<HTMLAttributes<HTMLElement>, SegmentOwnedAttributes>;

type SegmentButtonProps = SharedElementAttributes &
  SharedProps & {
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
  };

type SegmentAnchorProps = SharedElementAttributes &
  SharedProps & {
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

export type SegmentProps = SegmentButtonProps | SegmentAnchorProps;

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
