import { createContext } from 'svelte';

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
export type RadioGroupContext = {
  readonly name: string;
  readonly value: string;
  readonly disabled: boolean;
  readonly invalid: boolean;
  readonly required: boolean;
  select: (next: string) => void;
};

const [getRadioGroupContextStrict, setRadioGroupContext] = createContext<RadioGroupContext>();

export { setRadioGroupContext };

/**
 * Read the enclosing `<RadioGroup>` context. Throws via Svelte 5's
 * `createContext` when no provider exists — a `<Radio>` rendered outside
 * a `<RadioGroup>` is a programmer error.
 */
export const getRadioGroupContext = getRadioGroupContextStrict;
