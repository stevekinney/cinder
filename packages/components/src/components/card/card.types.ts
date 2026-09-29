import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';
import type {
  DataAttributes,
  PadUnion,
  WithoutDataAttributes,
} from '../../_internal/union-props.ts';
export type CardVariant = 'card' | 'well';
export type CardTone = 'default' | 'muted';
export type CardSurfaceTone = 'default' | 'danger';
export type CardElevation = 'none' | 'sm' | 'md' | 'lg';
/** Controls body padding. `none` removes only body padding for flush/full-bleed content. */
export type CardPadding = 'default' | 'none';
/** Heading level for the generated card title, so the document outline stays correct. */
export type CardHeadingLevel = 2 | 3 | 4 | 5 | 6;
// COR-239: keyof Props became too complex for TypeScript to represent (TS2590) once a consumer
// type-checked this published declaration under `skipLibCheck: false` — the root element type
// (div/anchor/button) split each forwarded a FULL svelte/elements attribute interface (including
// its `data-*` index signature) as one of three differing-key-set union arms. Fix: hoist the
// attribute surface common to all three render paths into one non-union type with `data-*`
// removed (`SharedHtmlAttributes`), restore `data-*` forwarding via a single non-distributed
// `DataAttributes` intersected once, and keep only the element-SPECIFIC attributes inside the
// (padded) small union. See `src/_internal/union-props.ts` for the full mechanism. No prop was
// added, removed, widened, or narrowed — arbitrary `data-*` props are still accepted on every
// arm, exactly as before.
type SharedHtmlAttributes = WithoutDataAttributes<
  Omit<HTMLAttributes<HTMLDivElement | HTMLAnchorElement | HTMLButtonElement>, 'class' | 'onclick'>
>;

// Both the header/title-mode union AND the element-type (div/anchor/button) union below are
// intentionally written INLINE rather than through separately-named types (this file previously
// had `CardStatic`/`CardLink`/`CardButton` and `CardPlain`/`CardWithHeader`/`CardWithTitle` as
// their own named aliases; a later attempt kept only one side named). Measured: naming EITHER
// side reintroduces TS2590 once combined with `SharedHtmlAttributes` and `DataAttributes` above
// — only having both sides inline, in this order (mode union outer, element union inner), keeps
// it clean. See `src/_internal/union-props.ts`'s module doc for the general mechanism, and
// button.types.ts for a fuller writeup of this same measured quirk on a smaller (two-arm) union.
type CardDiscriminant = (
  | {
      /** Basic card with no generated header. */
      children: Snippet;
      footer?: Snippet;
      header?: never;
      title?: never;
      headingLevel?: never;
      description?: never;
    }
  | {
      /** Card with a custom header snippet — full control over header content. */
      header: Snippet;
      children: Snippet;
      footer?: Snippet;
      title?: never;
      headingLevel?: never;
      description?: never;
    }
  | {
      /** Primary heading text rendered inside the card's header region. */
      title: string;
      /**
       * Heading level for the generated title. Defaults to `3`. Set this so the
       * card title nests correctly within the surrounding document outline.
       */
      headingLevel?: CardHeadingLevel;
      /** Optional subheading rendered as a paragraph below the title inside the header. */
      description?: string;
      children: Snippet;
      footer?: Snippet;
      header?: never;
    }
) &
  (
    | { href?: never; onclick?: never; type?: never }
    | (Omit<HTMLAnchorAttributes, keyof HTMLAttributes<HTMLAnchorElement> | 'type'> & {
        /** Destination URL that makes the entire card an anchor. */
        href: string;
        onclick?: (event: MouseEvent) => void;
      })
    | (Omit<HTMLButtonAttributes, keyof HTMLAttributes<HTMLButtonElement> | 'type'> & {
        /** Click handler that makes the entire card a button. */
        onclick: (event: MouseEvent) => void;
        href?: never;
      })
  );

/**
 * Props for the Card component. The cinder-specific base props are inlined here (rather than
 * factored into a separate named type) so `src/api-contract.test.ts`'s AST-only checker — which
 * looks for a literal object among a top-level intersection's members — can still see them.
 */
export type CardProps = SharedHtmlAttributes &
  DataAttributes &
  PadUnion<CardDiscriminant> & {
    /** Custom class merged with `.cinder-card`. */
    class?: string;
    /** Visual container style. `card` is raised; `well` is flatter and inset. */
    variant?: CardVariant;
    /** Elevation shadow applied to the card surface. */
    elevation?: CardElevation;
    /** Container risk treatment. `danger` renders a danger-zone surface for high-risk settings or destructive actions. */
    tone?: CardSurfaceTone;
    /** Body surface treatment. `muted` renders a grey/inset body region. */
    bodyTone?: CardTone;
    /** Footer surface treatment. `muted` renders a grey/inset footer region. */
    footerTone?: CardTone;
    /** Remove side borders/radius and bleed to the viewport edge on narrow screens. */
    edgeToEdgeOnMobile?: boolean;
    /** Body padding. `none` leaves header and footer padding intact while making body content flush with the card edges. */
    padding?: CardPadding;
  };
