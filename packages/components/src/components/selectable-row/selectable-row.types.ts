import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';
import type {
  DataAttributes,
  PadUnion,
  WithoutDataAttributes,
} from '../../_internal/union-props.ts';

export type SelectableRowDensity = 'comfortable' | 'condensed';
export type SelectableRowSelectedState = 'pressed' | 'current';
export type SelectableRowCurrentValue = 'page' | 'step' | 'location' | 'date' | 'time' | 'true';

// COR-239: keyof Props became too complex for TypeScript to represent (TS2590) once a consumer
// type-checked this published declaration under `skipLibCheck: false` — the button/anchor split
// each forwarded a FULL svelte/elements attribute interface (including its `data-*` index
// signature), and the two arms have different key sets. Fix: hoist the attribute surface common
// to both render paths into one non-union type with `data-*` removed (`SharedHtmlAttributes`),
// restore `data-*` forwarding via a single non-distributed `DataAttributes` intersected once, and
// keep only the element-SPECIFIC attributes inline inside the (padded) small union (naming this
// union's shapes was measured to reintroduce TS2590; see `src/_internal/union-props.ts` and
// button.types.ts for the general mechanism). No prop was added, removed, widened, or narrowed —
// arbitrary `data-*` props are still accepted on every arm, exactly as before. `title` is excluded
// from the shared surface because SelectableRow's own `title` prop (the row's Snippet label) is
// unrelated to the native tooltip attribute of the same name.
type SharedHtmlAttributes = WithoutDataAttributes<
  Omit<
    HTMLAttributes<HTMLButtonElement | HTMLAnchorElement>,
    'aria-current' | 'aria-pressed' | 'class' | 'href' | 'style' | 'title'
  >
>;

type SelectableRowDiscriminant =
  | (Omit<
      HTMLButtonAttributes,
      keyof HTMLAttributes<HTMLButtonElement> | 'href' | 'style' | 'title'
    > & {
      href?: undefined;
      /** Called when the native primary button activates. Optional for submit and reset buttons. */
      onclick?: (event: MouseEvent) => void;
      /** Native button type. @default "button" */
      type?: 'button' | 'submit' | 'reset';
      /** Accessible state mapping for selected button rows. @default "pressed" */
      selectedState?: SelectableRowSelectedState;
      /** `aria-current` value emitted when `selectedState="current"` and the row is selected. @default "true" */
      currentValue?: SelectableRowCurrentValue;
    })
  | (Omit<
      HTMLAnchorAttributes,
      keyof HTMLAttributes<HTMLAnchorElement> | 'href' | 'rel' | 'style' | 'target' | 'title'
    > & {
      /** Destination that renders the primary action as a native anchor. */
      href: string;
      /** Browsing context for the primary anchor. `_blank` merges `noopener noreferrer` into `rel`. */
      target?: HTMLAnchorAttributes['target'];
      /** `rel` forwarded to the primary anchor and de-duplicated case-insensitively; `noopener noreferrer` is merged when `target="_blank"`. */
      rel?: HTMLAnchorAttributes['rel'];
      /** `aria-current` value emitted when the linked row is selected. @default "true" */
      currentValue?: SelectableRowCurrentValue;
      selectedState?: never;
      type?: never;
    });

/** Props for SelectableRow. Pass `href` for a link or `onclick` for a button. */
export type SelectableRowProps = SharedHtmlAttributes &
  DataAttributes &
  PadUnion<SelectableRowDiscriminant> & {
    /** Density token surfaced as `data-cinder-density`. @default "comfortable" */
    density?: SelectableRowDensity;
    /** Whether the primary action represents the selected or current row. @default false */
    selected?: boolean;
    /** Leading visual such as an icon, avatar, marker, or status dot. */
    leading?: Snippet;
    /** Primary row label. Required so the native action has visible text and an accessible name. */
    title: Snippet;
    /** Secondary description below the title. */
    description?: Snippet;
    /** Tertiary metadata such as a timestamp, status, or compact badge. */
    meta?: Snippet;
    /** Independent controls rendered as siblings after the primary action. */
    trailingActions?: Snippet;
    /** Additional classes merged with `.cinder-selectable-row`. */
    class?: string;
    /** Inline style string applied to the `.cinder-selectable-row` root. */
    style?: string;
  };

/** Cinder-specific props used by the schema generator. */
export interface SelectableRowSchemaProps {
  /** Density token surfaced as `data-cinder-density`. @default "comfortable" */
  density?: SelectableRowDensity;
  /** Whether the primary action represents the selected or current row. @default false */
  selected?: boolean;
  /** Accessible state mapping for selected button rows. Links always use `aria-current`. @default "pressed" */
  selectedState?: SelectableRowSelectedState;
  /** Destination that renders the primary action as a native anchor. */
  href?: string;
  /** Browsing context for the primary anchor. `_blank` merges `noopener noreferrer` into `rel`. */
  target?: HTMLAnchorAttributes['target'];
  /** `rel` forwarded to the primary anchor and de-duplicated case-insensitively; `noopener noreferrer` is merged when `target="_blank"`. */
  rel?: HTMLAnchorAttributes['rel'];
  /** `aria-current` value emitted for a selected link or a selected button using `selectedState="current"`. @default "true" */
  currentValue?: SelectableRowCurrentValue;
  /** Native button type. @default "button" */
  type?: 'button' | 'submit' | 'reset';
  /** Leading visual such as an icon, avatar, marker, or status dot. */
  leading?: Snippet;
  /** Primary row label. Required. */
  title: Snippet;
  /** Secondary description below the title. */
  description?: Snippet;
  /** Tertiary metadata such as a timestamp, status, or compact badge. */
  meta?: Snippet;
  /** Independent controls rendered as siblings after the primary action. */
  trailingActions?: Snippet;
  /** Additional classes merged with `.cinder-selectable-row`. */
  class?: string;
  /** Inline style string applied to the `.cinder-selectable-row` root. */
  style?: string;
}
