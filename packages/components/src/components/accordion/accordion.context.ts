import { strictStableContext } from '../../_internal/strict-stable-context.ts';
import type { AccordionContext } from './accordion.types.ts';

export type { AccordionContext };

/**
 * Read the nearest enclosing `<Accordion>` context. Throws when no `<Accordion>`
 * ancestor has provided the context — an `<AccordionItem>` outside an `<Accordion>`
 * is a programmer error, not a supported state.
 */
const [getAccordionContext, setAccordionContext] = strictStableContext<AccordionContext>(
  '@lostgradient/cinder/accordion/context',
  'AccordionItem must be rendered inside an Accordion',
);

export { getAccordionContext, setAccordionContext };
