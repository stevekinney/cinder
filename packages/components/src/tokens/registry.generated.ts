/**
 * GENERATED FILE. Do not edit by hand.
 *
 * Source: the DTCG token corpus under components/cinder/src/tokens/.
 * Regenerate: bun run --filter=@lostgradient/cinder tokens:generate
 */

import registry from './registry.generated.json' with { type: 'json' };

/** One token's registry record. */
export type TokenRegistryEntry = {
  /** Dotted corpus path, e.g. `space.4`. */
  path: string;
  /** The custom property this token emits. */
  cssProperty: string;
  /** The token's category, when it declares one. */
  category?: string;
  /** The owning component, for component-scoped tokens. */
  component?: string;
  /** Whether the token is part of the public `--cinder-*` surface. */
  public: boolean;
  /** Whether a theme document overrides this token. */
  themeAware: boolean;
  /** The DTCG `$deprecated` value: `false`, `true`, or a message. */
  deprecated: boolean | string;
  /** The token's description, when it has one. */
  description?: string;
};

/** The registry's shape: every token, plus the lookups built over them. */
export type TokenRegistry = {
  entries: readonly TokenRegistryEntry[];
  pathToCssProperty: Readonly<Record<string, string>>;
  cssPropertyToPath: Readonly<Record<string, string>>;
  cssPropertyToPaths: Readonly<Record<string, readonly string[]>>;
  byCategory: Readonly<Record<string, readonly string[]>>;
  byComponent: Readonly<Record<string, readonly string[]>>;
};

/**
 * Declared as `TokenRegistry` rather than emitted `as const`.
 *
 * A literal type looks like a free upgrade -- exact keys, autocompletion -- but
 * it breaks both documented ways of using this data. Every lookup map keeps
 * only its generated keys and no string index signature, so
 * `TOKEN_REGISTRY.pathToCssProperty[path]` for a `string` path fails with
 * TS7053; and `entries` becomes a literal tuple whose elements each omit the
 * optional keys they happen not to carry, so reading `.component` while
 * iterating fails on any entry without one.
 *
 * Intersecting the literal with `TokenRegistry` fixes the first and not the
 * second. Since the value is generated data whose keys a consumer discovers at
 * runtime, the declared type is what they actually want.
 */
export const TOKEN_REGISTRY: TokenRegistry = registry;
