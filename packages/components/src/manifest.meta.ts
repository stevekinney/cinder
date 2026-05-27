/**
 * Closed-vocabulary source of truth for the cinder manifest system.
 *
 * This file defines the authoritative sets that per-component JSDoc metadata
 * references and that the manifest generator and `manifest.test.ts` enforce.
 * Add no runtime logic here — only data and derived types.
 */

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * Closed set of component categories with human-readable labels and
 * one-sentence descriptions used in the manifest and decision-aid docs.
 */
export const categories = {
  action: {
    label: 'Actions',
    description: 'Controls that trigger operations, submit data, or navigate.',
  },
  overlay: {
    label: 'Overlays',
    description: 'Floating surfaces that layer above page content and require user dismissal.',
  },
  form: {
    label: 'Forms',
    description: 'Input controls and layout primitives for collecting structured user data.',
  },
  feedback: {
    label: 'Feedback',
    description: 'Non-interactive indicators that communicate status, progress, or results.',
  },
  navigation: {
    label: 'Navigation',
    description: 'Wayfinding controls that move users between views, sections, or steps.',
  },
  'data-display': {
    label: 'Data Display',
    description: 'Read-only presentational components for structured data and content.',
  },
  layout: {
    label: 'Layout',
    description: 'Structural primitives that control spacing, containment, and composition.',
  },
  typography: {
    label: 'Typography',
    description: 'Text-rendering components that enforce hierarchy and typographic conventions.',
  },
  domain: {
    label: 'Domain',
    description: 'Application-specific components that encode product-level business concepts.',
  },
} as const satisfies Record<string, { label: string; description: string }>;

/** Union of all valid component category identifiers. */
export type CategoryId = keyof typeof categories;

// ---------------------------------------------------------------------------
// Status levels
// ---------------------------------------------------------------------------

/**
 * Closed set of component maturity statuses, mirroring the ROADMAP admission
 * tiers. Values are one-sentence descriptions suitable for agent consumption.
 */
export const statusLevels = {
  stable: 'Public API under semver protection; breaking changes require a major version bump.',
  beta: 'API is near-final but may have breaking changes in minor versions before promotion.',
  alpha: 'Experimental; no stability guarantee and subject to removal or significant redesign.',
  'domain-suite':
    'A cohesive set of domain-specific components shipped together as a named suite with its own versioning cadence.',
} as const satisfies Record<string, string>;

/** Union of all valid component status level identifiers. */
export type StatusLevel = keyof typeof statusLevels;

// ---------------------------------------------------------------------------
// Overlap families
// ---------------------------------------------------------------------------

/**
 * Explicit groupings of components that serve overlapping purposes.
 * Used by `manifest.test.ts` to enforce that every family member references
 * at least one sibling in its `useWhen` or `avoidWhen` guidance, and by
 * Phase 5 tooling to auto-render the decision-aid table in `AGENTS.md`.
 *
 * All values are kebab-case component ids matching `manifest.components[].id`.
 */
export const overlapFamilies = {
  overlay: ['modal', 'drawer', 'sheet', 'popover', 'alert-dialog'],
  notice: ['banner', 'alert', 'callout'],
  selection: ['toggle', 'checkbox', 'segmented-control'],
  hover: ['tooltip', 'popover', 'hover-card'],
  tabs: ['tabs', 'segmented-control'],
} as const satisfies Record<string, readonly string[]>;

/** Branded string alias for kebab-case component ids used in overlap families. */
export type ComponentId = string;

// ---------------------------------------------------------------------------
// Required constraints
// ---------------------------------------------------------------------------

/**
 * Component ids that MUST ship a constraints sidecar (`{name}.constraints.ts`).
 * `components:check` fails if any id listed here has `hasConstraints === false`
 * in the generated manifest (acceptance criterion 7).
 *
 * To expand this list: add the kebab-case component id here, author
 * `{name}.constraints.ts` with `defineConstraints(...)`, then verify the
 * evaluator test suite passes before committing.
 */
export const requiredConstraints = [
  'button',
  'input',
  'modal',
] as const satisfies readonly string[];

// ---------------------------------------------------------------------------
// Example exclusion reasons
// ---------------------------------------------------------------------------

/**
 * Allowed values for `// @cinder-example-exclude: <reason>` markers on
 * playground `.example.svelte` files. Any reason not in this list is a
 * hard error in the examples generator.
 *
 * The total number of exclusions across the package may not exceed 10 % of all
 * playground examples; see Phase 3 acceptance criteria for details.
 */
export const allowedExampleExclusionReasons = [
  'playground-only-interaction',
  'requires-router',
  'requires-server-data',
  'requires-iframe-isolation',
] as const satisfies readonly string[];

/** Union of allowed example exclusion reason strings. */
export type ExampleExclusionReason = (typeof allowedExampleExclusionReasons)[number];
