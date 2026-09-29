import type { Placement } from '@floating-ui/dom';
import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { AnchoredOverlayWidthMode } from '../../_internal/anchored-overlay.svelte.ts';
import type {
  DataAttributes,
  PadUnion,
  WithoutDataAttributes,
} from '../../_internal/union-props.ts';
export type DropdownPlacement = 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
export type DropdownContext = {
  get menuId(): string;
  get isOpen(): boolean;
  get supportsPopover(): boolean;
  readonly anchorElement?: HTMLElement | null | undefined;
  readonly fallbackAnchorElement?: HTMLElement | null | undefined;
  readonly fallbackPositionStyle?: string | undefined;
  readonly fallbackPositionReady?: boolean | undefined;
  readonly fallbackPlacement?: Placement | undefined;
  readonly widthMode?: AnchoredOverlayWidthMode | undefined;
  readonly initialFocus?: 'first' | 'last' | 'none' | undefined;
  close: () => void;
  focusTrigger: () => void;
};
// COR-239: keyof Props became too complex for TypeScript to represent (TS2590) once a consumer
// type-checked this published declaration under `skipLibCheck: false` — even though both arms
// shared the SAME `HTMLAttributes<HTMLDivElement>`-derived base, that base still carried the
// `data-*` index signature, and the two arms otherwise differ (`id`/`trigger`/`children`
// optionality). Fix: strip `data-*` from the shared base (`SharedHtmlAttributes`), restore it via
// a single non-distributed `DataAttributes` intersected once, and keep only the two arms' own
// differing fields inline (not through named types — measured to reintroduce TS2590; see
// `src/_internal/union-props.ts` and button.types.ts/card.types.ts for the general mechanism and
// a fuller writeup). No prop was added, removed, widened, or narrowed — arbitrary `data-*` props
// are still accepted on every arm, exactly as before.
type SharedHtmlAttributes = WithoutDataAttributes<Omit<HTMLAttributes<HTMLDivElement>, 'class'>>;

type DropdownDiscriminant =
  | {
      /** HTML id applied to the dropdown root element. Auto-generated when omitted. */
      id?: string;
      /** Controls the open state of the dropdown menu; bindable for controlled usage. */
      open?: boolean;
      /**
       * Preferred menu placement relative to the trigger. Default `bottom-start`.
       * The rendered menu may still flip to stay within the viewport.
       */
      placement?: DropdownPlacement;
      trigger: Snippet;
      children: Snippet;
    }
  | {
      id: string;
      children?: Snippet;
      trigger?: never;
      open?: never;
      /**
       * Preferred menu placement relative to the trigger. Default `bottom-start`.
       * The rendered menu may still flip to stay within the viewport.
       */
      placement?: DropdownPlacement;
    };

/**
 * Props for the Dropdown component. The cinder-specific base props are inlined here (rather than
 * factored into a separate named type) so `src/api-contract.test.ts`'s AST-only checker — which
 * looks for a literal object among a top-level intersection's members — can still see them.
 */
export type DropdownProps = SharedHtmlAttributes &
  DataAttributes &
  PadUnion<DropdownDiscriminant> & {
    /** Additional class names merged with the component's root class. */
    class?: string;
  };
