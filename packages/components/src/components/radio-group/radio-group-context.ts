import { createContext } from 'svelte';

// The canonical type definition lives in radio-group.types.ts (the public
// barrel re-exports it from there). Import rather than redefine to keep a
// single source of truth — field additions only need to go in one place.
import type { RadioGroupContext } from './radio-group.types.ts';

export type { RadioGroupContext };

/**
 * Context published by `<RadioGroup>` for descendant `<Radio>` children.
 *
 * All members are getter properties on the context object so reads stay
 * reactive — when a consumer reads `context.value` inside a `$derived`,
 * the read flows through the getter, which returns a value recomputed from
 * RadioGroup's `$derived` internals. Destructuring breaks reactivity;
 * getter reads preserve it.
 *
 * The context is *required* — a `<Radio>` outside a `<RadioGroup>` is a
 * programmer error. The `getRadioGroupContext` getter therefore throws
 * (via Svelte 5's `createContext`) when no provider exists.
 */

const [getRadioGroupContextStrict, setRadioGroupContext] = createContext<RadioGroupContext>();

export { setRadioGroupContext };

/**
 * Read the enclosing `<RadioGroup>` context. Throws via Svelte 5's
 * `createContext` when no provider exists — a `<Radio>` rendered outside
 * a `<RadioGroup>` is a programmer error.
 */
export const getRadioGroupContext = getRadioGroupContextStrict;
