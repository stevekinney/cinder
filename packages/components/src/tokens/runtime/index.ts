/**
 * `@lostgradient/cinder/tokens/runtime`: the pure token kernel shared by the
 * generator scripts and the browser.
 *
 * It is a narrow, in-memory interface -- validate, evaluate (resolve and
 * project), trace provenance -- plus the bundled Cinder base and the authoring
 * catalogue as data. It reads no files, fetches nothing, and formats nothing.
 * See `README.md` for the contract.
 *
 * There is deliberately no export for validating a document against the schema
 * alone: every path to a result runs the schema stage and then the semantic
 * rules together.
 */

export { AUTHORING_CATALOGUE } from './authoring-catalogue.generated.ts';
export { buildAuthoringCatalogue } from './authoring-catalogue.ts';
export { PROFILES, profileRangeViolation, selectProfile } from './authoring-profiles.ts';
export type { ProfileSubject } from './authoring-profiles.ts';
export { traceProvenance } from './authoring-provenance.ts';
export type { ProvenanceLayerInput, TraceOptions } from './authoring-provenance.ts';
export { PALETTE_FAMILIES, UNKNOWN, authoringContextId } from './authoring-types.ts';
export type {
  AuthoringCatalogue,
  AuthoringContext,
  AuthoringLayer,
  AuthoringRecord,
  ContributingLayer,
  EffectiveType,
  LayerKind,
  PaletteFamily,
  PaletteMembership,
  ProfileDefinition,
  ProfileRange,
  ProvenanceVariant,
  TokenContextProvenance,
  TokenDisposition,
  TokenInputs,
  TokenLocation,
} from './authoring-types.ts';
export { CINDER_BASE } from './base-corpus.ts';
export type { CinderBase } from './base-corpus.ts';
export { authoringContexts, authoringLayerStack } from './context-stack.ts';
export * from './contrast/index.ts';
export { evaluateTheme, evaluateThemeProperties, validateThemeSources } from './evaluate.ts';
export type {
  ThemeDiagnostic,
  ThemeEvaluation,
  ThemePropertiesEvaluation,
  ThemeSources,
  ThemeValidation,
} from './evaluate.ts';
export { evaluateContextProvenance } from './evaluated-provenance.ts';
export type { EvaluatedProvenance, TokenEvaluation } from './evaluated-provenance.ts';
export type { PropertyMap } from './projection.ts';
export { canonicalJson, computeSourceDigest, sha256Hex } from './source-digest.ts';
export type { DigestableSource } from './source-digest.ts';
export {
  OVERRIDE_DOCUMENTS,
  applyCssOnlyOverrides,
  buildThemeSources,
  mergedContextDocument,
} from './theme-sources.ts';
export type { OverrideScopeName, ThemeSourceEnvelope } from './theme-sources.ts';
export { StylesheetError, THEME_LAYER, renderThemeStylesheet } from './theme-stylesheet.ts';
export type {
  ContextProperties,
  StylesheetContext,
  ThemeStylesheetOptions,
} from './theme-stylesheet.ts';
export { TOKEN_TYPES, TokenValidationError } from './types.ts';
export type {
  DesignToken,
  ResolverDocument,
  TokenDocument,
  TokenGroup,
  TokenType,
  ValidationIssue,
} from './types.ts';
