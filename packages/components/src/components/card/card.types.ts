import type { Snippet } from 'svelte';
import type { HTMLAnchorAttributes, HTMLAttributes, HTMLButtonAttributes } from 'svelte/elements';
export type CardVariant = 'card' | 'well';
export type CardTone = 'default' | 'muted';
export type CardSurfaceTone = 'default' | 'danger';
export type CardElevation = 'none' | 'sm' | 'md' | 'lg';
/** Controls body padding. `none` removes only body padding for flush/full-bleed content. */
export type CardPadding = 'default' | 'none';
/** Heading level for the generated card title, so the document outline stays correct. */
export type CardHeadingLevel = 2 | 3 | 4 | 5 | 6;
type CardCommon = {
  /** Custom class merged with `.cinder-card`. */
  class?: string;
  /** Visual container style. `card` is raised; `well` is flatter and inset. */
  variant?: CardVariant;
  /** Elevation shadow applied to the card surface. */
  elevation?: CardElevation;
  /** Container risk treatment. `status.danger.solid` renders a danger-zone surface for high-risk settings or destructive actions. */
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
type CardStatic = CardCommon &
  Omit<HTMLAttributes<HTMLDivElement>, 'class' | 'href' | 'onclick' | 'type'> & {
    href?: never;
    onclick?: never;
    type?: never;
  };
type CardLink = CardCommon &
  Omit<HTMLAnchorAttributes, 'class' | 'href' | 'onclick' | 'type'> & {
    /** Destination URL that makes the entire card an anchor. */
    href: string;
    onclick?: (event: MouseEvent) => void;
  };
type CardButton = CardCommon &
  Omit<HTMLButtonAttributes, 'class' | 'onclick' | 'type'> & {
    /** Click handler that makes the entire card a button. */
    onclick: (event: MouseEvent) => void;
    href?: never;
  };
type CardBase = CardStatic | CardLink | CardButton;
/** Basic card with no generated header. */
type CardPlain = CardBase & {
  children: Snippet;
  footer?: Snippet;
  header?: never;
  title?: never;
  headingLevel?: never;
  description?: never;
};
/** Card with a custom header snippet — full control over header content. */
type CardWithHeader = CardBase & {
  header: Snippet;
  children: Snippet;
  footer?: Snippet;
  title?: never;
  headingLevel?: never;
  description?: never;
};
/** Card with a title/description string API — simpler for standard cards. */
type CardWithTitle = CardBase & {
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
};
export type CardProps = CardPlain | CardWithHeader | CardWithTitle;
