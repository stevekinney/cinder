/**
 * COR-239: helpers for keeping a component's public `Props` union cheap for
 * TypeScript to `keyof`, without dropping any accepted input.
 *
 * ## The measured problem
 *
 * Svelte's `Component<Props, Exports, Bindings extends keyof Props | ''>`
 * computes `keyof Props` to check the `Bindings` constraint. A consumer
 * type-checking a published component under `skipLibCheck: false` — the
 * setting a real install always runs under, since `skipLibCheck: true` only
 * skips *other* packages' `.d.ts` files — hit TS2590 ("Expression produces a
 * union type that is too complex to represent") on fifteen Cinder
 * components.
 *
 * This was isolated with controlled fixtures. TS2590 appears specifically
 * when a Props union has two or more arms where (a) each arm carries the
 * `` [key: `data-${string}`]: any `` index signature that `svelte/elements`'
 * `HTMLAttributes<T>` mixes in, AND (b) the arms otherwise differ — different
 * key sets, or different "big" attribute interfaces (`HTMLButtonAttributes`
 * vs. `HTMLAnchorAttributes`). Stripping only the `data-*` index signature
 * removes TS2590; stripping a `symbol` index signature does not; the
 * `Record<string, any>`-shaped constraint alone is fine; and the generic
 * inheritance chain those interfaces sit in
 * (`HTMLAttributes<T> extends AriaAttributes, DOMAttributes<T>`) is not the
 * cause by itself.
 *
 * ## Why not just drop `data-*` support
 *
 * A prior attempt did exactly that — flattened the attribute interfaces and
 * dropped their `data-*` index signature. It was rejected: real consumers
 * pass arbitrary `data-*` props to these components (e.g. `data-message-id`
 * on Button, `data-active` on DropdownItem), and losing that silently breaks
 * them with no compiler error to catch it.
 *
 * ## The fix
 *
 * Restructure each affected Props type as:
 *
 * ```ts
 * type Props = SharedAttributes & DataAttributes & PadUnion<SmallDiscriminatedUnion>;
 * ```
 *
 * - `SharedAttributes` is the ONE non-union HTML-attribute type common to
 *   every arm, built with {@link WithoutDataAttributes} so its `data-*` index
 *   signature is gone. `keyof` only walks it once — it's outside the union.
 * - `DataAttributes` (this module's {@link DataAttributes}) restores a single,
 *   non-distributed `` { [key: `data-${string}`]: any } `` intersected
 *   outside the union, so every arm still accepts arbitrary `data-*` props —
 *   `keyof` only has to account for it once instead of once per arm.
 * - `SmallDiscriminatedUnion` keeps only the parts that actually vary between
 *   arms: element-specific attributes (e.g. `formaction` vs. `href`) — often
 *   `Omit<HTMLButtonAttributes, keyof HTMLAttributes<HTMLButtonElement> | ...>`
 *   to subtract the shared surface `SharedAttributes` already covers, leaving
 *   only the element-specific remainder — discriminant fields, and
 *   component-specific unions. It never itself references the *shared*
 *   `HTMLAttributes<T>` base directly (that always lives in `SharedAttributes`
 *   outside the union).
 * - {@link PadUnion} pads every arm of that small union with the keys it
 *   lacks, typed `?: never`, so every arm presents the same key set — the
 *   other lever that keeps `keyof` cheap for a union of otherwise-differing
 *   shapes.
 *
 * ## A padding trap to avoid
 *
 * `PadUnion` pads a key as `never` on any arm that doesn't already declare
 * it, based on every OTHER arm in the union. If that key is also a real,
 * separately-typed key somewhere OUTSIDE the union — on `SharedAttributes`,
 * or on a trailing cinder-props object intersected alongside `PadUnion<...>`
 * — the padded `never` intersects with that real type and collapses it to
 * `undefined`, silently rejecting values the unpadded arm must keep
 * accepting. This bit Button's `aria-label`/`aria-labelledby` (present only
 * in its icon-only sub-arms, but also real optional keys on
 * `SharedAttributes`) and `leadingIcon`/`trailingIcon` (present only in an
 * icon-only sub-arm, but also real optional keys on the trailing cinder-props
 * object) — see button.types.ts's `ButtonPaddedKeys` for the fix: pass
 * `PadUnion`'s second type parameter to exclude exactly those keys from
 * padding.
 */

/** Every key across every arm of a union `U`, computed by distributing over `U`. */
export type AllKeys<U> = U extends unknown ? keyof U : never;

/**
 * Pads every arm of union `U` with the keys it lacks (relative to every other
 * arm) as optional `never`, so all arms present an identical key set to
 * `keyof`. Combined with removing the `data-*` index signature from any
 * shared attribute type intersected outside the union, this is what keeps
 * `keyof` cheap for a Props union whose arms otherwise differ.
 *
 * `?: never` (not `?: undefined`) matches this workspace's existing
 * sentinel-prop convention (e.g. Card's `header?: never`) and is unaffected
 * by `exactOptionalPropertyTypes`: the property may only be omitted, since no
 * value — including `undefined` — is assignable to `never`.
 */
export type PadUnion<U, All extends PropertyKey = AllKeys<U>> = U extends unknown
  ? U & { [K in Exclude<All, keyof U>]?: never }
  : never;

/**
 * A single, non-distributed `data-*` index signature, typed `any` to match
 * `svelte/elements`' `HTMLAttributes<T>` exactly — so accepting or reading an
 * arbitrary `data-*` prop behaves exactly as it did before this type was
 * introduced. Intersect this OUTSIDE a Props union (never inside one of its
 * arms) so `keyof` accounts for it once rather than once per arm.
 */
export type DataAttributes = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- matches svelte/elements' own `data-*` index signature exactly.
  [key: `data-${string}`]: any;
};

/**
 * Removes the `` `data-${string}` `` index signature from a `svelte/elements`
 * attribute type (`HTMLAttributes<T>`, `HTMLButtonAttributes`,
 * `HTMLAnchorAttributes`, …), leaving every named property untouched. Pair
 * with {@link DataAttributes} intersected once outside the union to keep
 * `data-*` forwarding without reintroducing TS2590.
 */
export type WithoutDataAttributes<T> = {
  [K in keyof T as K extends `data-${string}` ? never : K]: T[K];
};
