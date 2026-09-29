import type { Snippet } from 'svelte';
import type { DataAttributes, PadUnion } from '../../_internal/union-props.ts';
import type {
  NavigationItemButtonExtra,
  NavigationItemLinkExtra,
  NavigationItemSharedHtmlAttributes,
} from '../navigation-item/navigation-item.types.ts';

/**
 * Props for the SideNavigationItem component.
 *
 * Forwards all NavigationItem props except `variant` — side navigation always renders the
 * vertical variant so consumers cannot accidentally introduce a tombstone (horizontal-radius)
 * focus ring inside a sidebar list.
 *
 * COR-239: this used to be `DistributiveOmit<NavigationItemProps, 'variant'> & {...}`, where the
 * distributive `T extends unknown ? Omit<T, K> : never` trick fanned the `Omit` across
 * `NavigationItemProps`'s own link/button arms so the href/button discriminant survived. Once
 * `NavigationItemProps` itself was restructured (see navigation-item.types.ts) to avoid TS2590,
 * it is a single `TSIntersectionType` at the top level rather than a naked union — the
 * distributive trick no longer has a union to distribute over, so it would silently collapse
 * back to a plain `Omit` and lose the href/button exclusivity the comment above used to warn
 * about. This file instead re-assembles the same shape directly from the pieces
 * navigation-item.types.ts now exports for this purpose, rather than post-processing the
 * already-combined `NavigationItemProps`.
 */
export type SideNavigationItemProps = NavigationItemSharedHtmlAttributes &
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
    children: Snippet;
    /** Class merged onto the outer <li>. */
    listItemClass?: string;
  };
