import { createContext } from 'svelte';

import type { AccordionContext } from './accordion.types.ts';

export type { AccordionContext };

const [getAccordionContextStrict, setAccordionContext] = createContext<AccordionContext>();

export { setAccordionContext };

/**
 * Read the nearest enclosing `<Accordion>` context. Throws when no `<Accordion>`
 * ancestor has provided the context — an `<AccordionItem>` outside an `<Accordion>`
 * is a programmer error, not a supported state.
 */
export const getAccordionContext = getAccordionContextStrict;
