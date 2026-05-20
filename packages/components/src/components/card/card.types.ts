import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
export type CardVariant = 'card' | 'well';
export type CardTone = 'default' | 'muted';
type CardBase = HTMLAttributes<HTMLDivElement> & {
  class?: string;
  /** Visual container style. `card` is raised; `well` is flatter and inset. */
  variant?: CardVariant;
  /** Body surface treatment. `muted` renders a grey/inset body region. */
  bodyTone?: CardTone;
  /** Footer surface treatment. `muted` renders a grey/inset footer region. */
  footerTone?: CardTone;
  /** Remove side borders/radius and bleed to the viewport edge on narrow screens. */
  edgeToEdgeOnMobile?: boolean;
};
/** Basic card with no generated header. */
type CardPlain = CardBase & {
  children: Snippet;
  footer?: Snippet;
  header?: never;
  title?: never;
  description?: never;
};
/** Card with a custom header snippet — full control over header content. */
type CardWithHeader = CardBase & {
  header: Snippet;
  children: Snippet;
  footer?: Snippet;
  title?: never;
  description?: never;
};
/** Card with a title/description string API — simpler for standard cards. */
type CardWithTitle = CardBase & {
  title: string;
  description?: string;
  children: Snippet;
  footer?: Snippet;
  header?: never;
};
export type CardProps = CardPlain | CardWithHeader | CardWithTitle;
