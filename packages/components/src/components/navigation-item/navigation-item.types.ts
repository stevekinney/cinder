import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';
import type {
  DataAttributes,
  PadUnion,
  WithoutDataAttributes,
} from '../../_internal/union-props.ts';

// COR-239: keyof Props became too complex for TypeScript to represent (TS2590) once a consumer
// type-checked this published declaration under `skipLibCheck: false` — `LinkArm`/`ButtonArm`
// each forwarded the FULL `HTMLAnchorAttributes`/`HTMLButtonAttributes` surface (including its
// `data-*` index signature), and the two arms have different key sets. Fix: hoist the attribute
// surface common to both render paths into one non-union type with `data-*` removed
// (`SharedHtmlAttributes`), restore `data-*` forwarding via a single non-distributed
// `DataAttributes` intersected once, and keep only the element-SPECIFIC attributes inside the
// (padded) small union. See `src/_internal/union-props.ts` for the full mechanism. No prop was
// added, removed, widened, or narrowed — arbitrary `data-*` props are still accepted on every
// arm, exactly as before.
//
// `aria-current` and `aria-disabled` are owned by the component (derived from the
// `active` / `disabled` props and emitted after the attribute spread), so they're excluded from
// the shared surface below; a consumer value is a compile error rather than being silently
// overridden at runtime. `disabled` is owned by the cinder-specific props (not a native
// attribute) so it's excluded from the button arm's native surface too, keeping a single source
// of truth (matching the `buttonAttributes` runtime cast).
export type NavigationItemSharedHtmlAttributes = WithoutDataAttributes<
  Omit<
    HTMLAttributes<HTMLAnchorElement | HTMLButtonElement>,
    'class' | 'onclick' | 'aria-current' | 'aria-disabled'
  >
>;

export type NavigationItemLinkExtra = Omit<
  HTMLAnchorAttributes,
  keyof HTMLAttributes<HTMLAnchorElement> | 'href'
> & {
  /** Destination URL. Providing this prop renders the item as an `<a>` element instead of a `<button>`. */
  href: string;
  /**
   * Optional click handler called for the rendered `<a>` element. Useful for
   * intercepting plain left-clicks for SPA navigation while letting modified
   * clicks (cmd/ctrl/shift/alt or middle-click) fall through to native browser
   * behavior. Disabled-state preventDefault still applies.
   */
  onclick?: (event: MouseEvent) => void;
};
export type NavigationItemButtonExtra = Omit<
  HTMLButtonAttributes,
  keyof HTMLAttributes<HTMLButtonElement> | 'disabled' | 'type'
> & {
  href?: undefined;
  onclick: (event: MouseEvent) => void;
};

/** Props for the NavigationItem component. Pass `href` for a link, `onclick` for a button. */
export type NavigationItemProps = NavigationItemSharedHtmlAttributes &
  DataAttributes &
  PadUnion<NavigationItemLinkExtra | NavigationItemButtonExtra> & {
    /** Marks this item as the currently active destination; emits `aria-current` and applies active visual styling. */
    active?: boolean;
    /** Prevents interaction: removes the item from the tab order, blocks clicks, and applies disabled visual styling. */
    disabled?: boolean;
    /**
     * The `aria-current` token emitted while `active` is true. Defaults to `'page'`,
     * which is correct for navigation bars and breadcrumb-adjacent links. Use
     * `'true'` (or another standard token such as `'step'` / `'location'`) for
     * section/view switchers, where `'page'` would mislabel the current section as
     * the current page in the browsing context.
     */
    current?: 'page' | 'step' | 'location' | 'date' | 'time' | 'true';
    /** Additional class merged onto the `.cinder-navigation-item` root element. */
    class?: string;
    /**
     * Controls item geometry. Emitted as `data-variant`. Default `'horizontal'`.
     *
     * - `'horizontal'`: top-rounded radius, accent bottom-border active indicator.
     *   Used inside `NavigationBar` and similar horizontal tab-bar contexts.
     * - `'mobile'`: stacked full-width layout when an owning navigation surface
     *   enters its narrow container mode.
     * - `'vertical'`: square row geometry, neutral selected surface, and accent inline-start border active indicator.
     *   Used inside `SideNavigation` (set automatically by `SideNavigationItem`) or
     *   standalone sidebar footers where flush sidebar edges are required.
     */
    variant?: 'horizontal' | 'mobile' | 'vertical';
    children: Snippet;
  };
