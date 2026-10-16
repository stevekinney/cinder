/**
 * Data model for the token authoring catalogue.
 *
 * This module is deliberately free of Node imports and of any import that
 * reaches Node: the shapes below are the contract the browser-side token
 * runtime (COR-491) consumes, so they must be movable into
 * `src/tokens/runtime/` unchanged. Everything here is plain JSON-serializable
 * data.
 *
 * The central record is {@link TokenContextProvenance}: where one token's value
 * and type come from in one concrete modifier context. The catalogue stores it
 * per token and per context (deduplicated into {@link ProvenanceVariant}s),
 * and the runtime recomputes the same shape from an edited layer stack.
 */

import type { TokenType } from './types.ts';

/** The literal rendered for source metadata the corpus does not declare. */
export const UNKNOWN = 'unknown' as const;
export type Unknown = typeof UNKNOWN;

/** One concrete modifier combination, e.g. `{ theme: 'dark', motion: 'reduced' }`. */
export type AuthoringContext = {
  /** Deterministic id: `<theme>/<motion>`. */
  id: string;
  theme: string;
  motion: string;
};

export function authoringContextId(theme: string, motion: string): string {
  return `${theme}/${motion}`;
}

/** Whether a layer is a resolver set or one context of a modifier. */
export type LayerKind = 'set' | 'modifier';

/** One ordered document in a context's resolution stack. */
export type AuthoringLayer = {
  /** The document id: its repository-relative source path. */
  document: string;
  kind: LayerKind;
  /** The resolver entry that contributed it, e.g. `sets.foundation` or `theme.dark`. */
  layer: string;
};

/** A token path inside one document. */
export type TokenLocation = { document: string; path: string };

/** A layer that supplies a token, plus how it supplies it. */
export type ContributingLayer = TokenLocation &
  AuthoringLayer & {
    /** `declared` is written in the layer; `extends` arrives through a group `$extends`. */
    via: 'declared' | 'extends';
  };

/** The effective DTCG type and where it is declared. */
export type EffectiveType = {
  type: TokenType | Unknown;
  /** `local` is typed on the token itself; `inherited` comes from an ancestor group. */
  origin: 'local' | 'inherited' | Unknown;
  /** The node that declares the type: the token (local) or the group (inherited). */
  declaredAt: TokenLocation | Unknown;
};

/** The direct inputs of the winning declaration. */
export type TokenInputs = {
  /** Token paths named by `{a.b}` references inside `$value`, in first-use order. */
  aliases: string[];
  /** Token paths named by a whole-token `$ref` pointer. */
  refs: string[];
  /** Groups the token's ancestors extend: `group` extends `target`. */
  extends: Array<{ group: string; target: string }>;
  /** Public custom properties a trusted `cssRecipe` reads through `var()`. */
  recipes: Array<{ cssProperty: string; path: string }>;
};

/** Provenance of one token in one concrete context. The TB02 runtime reuses this shape. */
export type TokenContextProvenance = {
  /** The winning declaration (the last contributing layer). */
  winner: TokenLocation;
  /** Every layer that supplies the token, lowest precedence first. */
  layers: ContributingLayer[];
  effectiveType: EffectiveType;
  inputs: TokenInputs;
};

/** One provenance record shared by every context in `contexts`. */
export type ProvenanceVariant = {
  contexts: string[];
  provenance: TokenContextProvenance;
};

/** How a token may be edited, exported as CSS, and exported as portable DTCG. */
export type TokenDisposition = {
  /**
   * `supported` edits the DTCG `$value`; `recipe` edits a trusted `cssRecipe`
   * that governs the CSS; `css-only` has no DTCG-editable value at all.
   */
  edit: 'supported' | 'recipe' | 'css-only';
  /** Every public token is emitted into `tokens-base.css`. */
  cssExport: 'supported';
  /**
   * `complete` exports the whole token; `subset` exports the DTCG value but not
   * the CSS recipe that governs the emitted CSS; `none` exports nothing,
   * because the token has no faithful portable value.
   */
  dtcgExport: 'complete' | 'subset' | 'none';
  cssSerialization: 'typed-value' | 'trusted-recipe' | 'mixed';
  /** The real CSS value, present only for `css-only` tokens. Never a placeholder. */
  cssValue?: string;
  /** Why a token is not fully portable. */
  reason?: string;
};

/** The numeric part a usage profile constrains. */
export type ProfileNumericPart = 'number' | 'dimension.value' | 'duration.value' | 'fontWeight';

/** A machine-readable numeric constraint. All bounds are inclusive unless stated. */
export type ProfileRange = {
  part: ProfileNumericPart;
  finite: true;
  min?: number;
  max?: number;
  /** When true the `min` bound itself is rejected (`> min`). */
  minExclusive?: boolean;
  integer?: boolean;
};

/** A CSS usage contract: what a token may legally be, given the properties it feeds. */
export type ProfileDefinition = {
  id: string;
  description: string;
  /** DTCG types a token with this profile may have (a trusted `cssRecipe` may override). */
  types: TokenType[];
  /** The CSS properties the token is consumed by. */
  cssUsage: string[];
  /** Absent for non-numeric profiles. */
  range?: ProfileRange;
  /** Named values accepted in place of a number (font weights). */
  keywords?: string[];
};

/** The palette families a color token may belong to. */
export const PALETTE_FAMILIES = [
  'accent',
  'neutral',
  'success',
  'warning',
  'danger',
  'info',
] as const;
export type PaletteFamily = (typeof PALETTE_FAMILIES)[number];

/** A color token's declared membership of one palette family. */
export type PaletteMembership = {
  family: PaletteFamily;
  /** The role the token plays inside the family, unique within the family. */
  role: string;
  /** True for the single token that holds the family's seed-matching color. */
  anchor: boolean;
};

/** One generated record per public registry entry. */
export type AuthoringRecord = {
  path: string;
  cssProperty: string;
  /** The literal `unknown` when the corpus declares none. */
  category: string;
  component: string | null;
  /** The literal `unknown` when the corpus declares none. */
  description: string;
  themeAware: boolean;
  deprecated: boolean | string;
  /** The usage profile id (see `authoring-profiles.ts`). */
  profile: string;
  /** The scale this token is a member of, when the corpus marks one. */
  scale?: string;
  /**
   * Palette membership of a color token, from the explicit `palette` extension in source (never
   * inferred from the token name). A color token that declares none reports `unknown`.
   */
  palette?: PaletteMembership | { family: Unknown; role: Unknown; anchor: Unknown };
  disposition: TokenDisposition;
  variants: ProvenanceVariant[];
};

/** The generated artifact. */
export type AuthoringCatalogue = {
  version: 1;
  dtcgVersion: '2025.10';
  contexts: AuthoringContext[];
  /** Ordered layer stack per context id. */
  layerStacks: Record<string, AuthoringLayer[]>;
  /** Profile definitions referenced by `AuthoringRecord.profile`. */
  profiles: Record<string, ProfileDefinition>;
  /** Scale name -> member token paths, in group order. */
  scales: Record<string, string[]>;
  records: AuthoringRecord[];
};
