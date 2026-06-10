import { createContext } from 'svelte';

import type { ChoiceGridContext } from './choice-grid.types.ts';

export type { ChoiceGridContext };

/**
 * Context published by `<ChoiceGrid>` for descendant `<ChoiceGridItem>` children.
 *
 * All members are getter properties on the context object so reads stay
 * reactive — when a consumer reads `context.value` inside a `$derived`,
 * the read flows through the getter which returns a value recomputed from
 * ChoiceGrid's `$derived` internals. Destructuring breaks reactivity;
 * getter reads preserve it.
 *
 * The context is *required* — a `<ChoiceGridItem>` outside a `<ChoiceGrid>` is a
 * programmer error. The `getChoiceGridContext` getter therefore throws
 * (via Svelte 5's `createContext`) when no provider exists.
 */

const [getChoiceGridContextStrict, setChoiceGridContext] = createContext<ChoiceGridContext>();

export { setChoiceGridContext };

/**
 * Read the enclosing `<ChoiceGrid>` context. Throws via Svelte 5's
 * `createContext` when no provider exists — a `<ChoiceGridItem>` rendered
 * outside a `<ChoiceGrid>` is a programmer error.
 */
export const getChoiceGridContext = getChoiceGridContextStrict;
