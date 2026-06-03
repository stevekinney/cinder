import AccordionItem from '../accordion-item/accordion-item.svelte';
import './accordion.css';
import AccordionRoot from './accordion.svelte';

/**
 * `Accordion` is the parent compound component and a namespace exposing the
 * compose-only `Accordion.Item` leaf. The leaf remains importable individually
 * via `cinder/accordion-item`.
 */
const Accordion = Object.assign(AccordionRoot, {
  Item: AccordionItem,
});

export default Accordion;
export { ACCORDION_CONTEXT_KEY } from './accordion.context.ts';
export type { AccordionContext, AccordionItemProps, AccordionProps } from './accordion.types.ts';
export { Accordion };
