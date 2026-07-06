import { getContext, setContext } from 'svelte';

import type { AccordionContext } from './accordion.types.ts';

export type { AccordionContext };

const ACCORDION_CONTEXT_KEY = Symbol.for('@lostgradient/cinder/accordion/context');

function setAccordionContext(context: AccordionContext): AccordionContext {
  return setContext(ACCORDION_CONTEXT_KEY, context);
}

/**
 * Read the nearest enclosing `<Accordion>` context. Throws when no `<Accordion>`
 * ancestor has provided the context — an `<AccordionItem>` outside an `<Accordion>`
 * is a programmer error, not a supported state.
 */
function getAccordionContext(): AccordionContext {
  const context = getContext<AccordionContext | undefined>(ACCORDION_CONTEXT_KEY);
  if (context === undefined) {
    throw new Error('missing_context: AccordionItem must be rendered inside an Accordion');
  }
  return context;
}

export { getAccordionContext, setAccordionContext };
