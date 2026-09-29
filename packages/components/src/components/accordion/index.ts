import AccordionItem from '../accordion-item/accordion-item.svelte';
import './accordion.css';
import AccordionRoot from './accordion.svelte';

/**
 * `Accordion` is the parent compound component and a namespace exposing the
 * compose-only `Accordion.Item` leaf.
 * The leaf is also a named export of `@lostgradient/cinder`.
 */
const Accordion = Object.assign(AccordionRoot, {
  Item: AccordionItem,
});

export default Accordion;
export type { AccordionContext, AccordionItemProps, AccordionProps } from './accordion.types.ts';
export { Accordion };
