/**
 * Canonical fixture schema for visual-regression fixture files.
 *
 * Every `<component-name>-fixtures.ts` file authored for the visual-regression
 * pipeline must export an array that satisfies `VisualFixture[]` and (when
 * needed) an object that satisfies `VisualFixtureMetadata`. Call
 * `parseFixtureFile` at load-time to validate both arrays and enforce all
 * cross-cutting constraints in one place.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pattern all fixture names must match: lowercase kebab-case starting with a letter. */
export const FIXTURE_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Maximum number of characters allowed in a fixture name. */
export const FIXTURE_NAME_MAX_LENGTH = 40;

/** Names that component authors are not allowed to use. */
export const RESERVED_FIXTURE_NAMES = ['default'] as const;

/** Maximum number of fixtures per file before `fixtureBudgetOverride` is required. */
export const DEFAULT_FIXTURE_BUDGET = 5;

/** Default maximum allowed mask coverage as a percentage of the snapshot area. */
export const DEFAULT_MASK_MAX_AREA_PERCENT = 10;

/** Closed enum of recognised mask reasons. */
export const MASK_REASONS = [
  'timestamp',
  'generated-id',
  'external-avatar',
  'rng-content',
] as const;

/** Closed enum of supported interaction actions. */
export const INTERACTION_ACTIONS = ['focus', 'click', 'hover', 'press'] as const;

/**
 * Screenshot taxonomy — the kind of review artifact a fixture produces. Lets
 * reviewers (and the contact-sheet tooling) tell a component's canonical visual
 * contract apart from a documentation page, a primitive shown only in a
 * composition, or an interaction-state capture.
 *
 *   - `visual-contract`: the component's own default/canonical rendered states.
 *   - `primitive-composition`: a low-level primitive shown inside the smallest
 *     realistic composition that proves it works (it has no meaningful
 *     standalone visual).
 *   - `interaction-state`: a capture taken AFTER `interact` steps — hover,
 *     focus, selected/current, open, disabled — where brand/usability lives.
 *   - `documentation`: playground chrome / doc-oriented pages, not a component
 *     visual contract.
 *
 * Defaults to `visual-contract` when a fixture omits it.
 */
export const FIXTURE_CATEGORIES = [
  'visual-contract',
  'primitive-composition',
  'interaction-state',
  'documentation',
] as const;

export type FixtureCategory = (typeof FIXTURE_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// JsonValue — recursive schema, plain objects only
// ---------------------------------------------------------------------------

// The self-referential type annotation is the only way to express the recursive
// union to TypeScript. eslint-disable keeps the explicit-any rule from firing on
// the type alias that is required here by Zod's lazy typing.
/* eslint-disable @typescript-eslint/no-explicit-any */
type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.boolean(),
    z.number(),
    z.string(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Sub-schemas
// ---------------------------------------------------------------------------

/**
 * Schema for a single interaction step. An interaction targets an element
 * identified by its `data-testid` value and performs one supported action.
 */
export const InteractionStepSchema = z
  .object({
    action: z.enum(INTERACTION_ACTIONS),
    target: z.object({
      testId: z.string().min(1),
    }),
    /** Required and non-empty when `action === 'press'`. Ignored for other actions. */
    key: z.string().min(1).optional(),
  })
  .refine((step) => step.action !== 'press' || (step.key !== undefined && step.key.length > 0), {
    message: "The 'key' field is required and must be non-empty when action is 'press'.",
    path: ['key'],
  });

/**
 * Schema for a single mask rule. A mask hides a region of the snapshot during
 * pixel comparison to prevent flaky diffs caused by dynamic content.
 */
const MaskRuleSchema = z.object({
  testId: z.string().min(1),
  reason: z.enum(MASK_REASONS),
  maxAreaPercent: z.number().gt(0).lte(DEFAULT_MASK_MAX_AREA_PERCENT),
});

// ---------------------------------------------------------------------------
// Primary schemas
// ---------------------------------------------------------------------------

/**
 * Zod schema for a single visual-regression fixture entry.
 *
 * - `name`: lowercase kebab-case, max 40 chars, not `'default'`.
 * - `props`: JSON-serializable value — no `Date`, class instances, functions,
 *   or symbols allowed.
 * - `interact`: optional ordered list of interaction steps to perform before
 *   capturing the snapshot.
 * - `mask`: optional list of regions to hide during pixel comparison.
 * - `category`: the screenshot-taxonomy bucket (see {@link FIXTURE_CATEGORIES}).
 *   Defaults to `interaction-state` when the fixture has `interact` steps,
 *   otherwise `visual-contract`.
 */
export const VisualFixtureSchema = z
  .object({
    name: z
      .string()
      .regex(FIXTURE_NAME_PATTERN, {
        message: `Fixture name must match ${String(FIXTURE_NAME_PATTERN)} (lowercase kebab-case starting with a letter)`,
      })
      .max(FIXTURE_NAME_MAX_LENGTH, {
        message: `Fixture name must not exceed ${FIXTURE_NAME_MAX_LENGTH} characters`,
      })
      .refine((value) => !(RESERVED_FIXTURE_NAMES as readonly string[]).includes(value), {
        message: `Fixture name '${RESERVED_FIXTURE_NAMES.join("', '")}' is reserved`,
      }),
    props: JsonValueSchema,
    interact: z.array(InteractionStepSchema).optional(),
    mask: z.array(MaskRuleSchema).optional(),
    category: z.enum(FIXTURE_CATEGORIES).optional(),
  })
  .transform((fixture) => ({
    ...fixture,
    // Resolve the taxonomy default: an interaction fixture is an
    // interaction-state capture unless it says otherwise.
    category:
      fixture.category ??
      (fixture.interact && fixture.interact.length > 0
        ? ('interaction-state' as const)
        : ('visual-contract' as const)),
  }));

/**
 * Zod schema for the optional metadata constant exported alongside a fixture
 * array. When the fixture array exceeds `DEFAULT_FIXTURE_BUDGET` entries,
 * `fixtureBudgetOverride` is required.
 */
export const VisualFixtureMetadataSchema = z.object({
  fixtureBudgetOverride: z
    .object({
      reason: z.string().min(1),
      approvedBy: z.string().min(1),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

/** A single validated visual-regression fixture entry. */
export type VisualFixture = z.infer<typeof VisualFixtureSchema>;

/** Optional metadata attached to a fixture file. */
export type VisualFixtureMetadata = z.infer<typeof VisualFixtureMetadataSchema>;

/** A single interaction step within a fixture. */
export type InteractionStep = z.infer<typeof InteractionStepSchema>;

/** A single mask rule within a fixture. */
export type MaskRule = z.infer<typeof MaskRuleSchema>;

// ---------------------------------------------------------------------------
// parseFixtureFile
// ---------------------------------------------------------------------------

/**
 * Validates a fixture file's exports and enforces all cross-cutting
 * constraints. Throws a single `Error` listing every violation when the
 * input is invalid.
 *
 * Cross-cutting constraints enforced here (beyond shape):
 * - All fixture names must be unique after lowercasing and trimming.
 * - If `fixtures.length > DEFAULT_FIXTURE_BUDGET`, `metadata.fixtureBudgetOverride`
 *   is required.
 *
 * @param input.fixtures - The raw value of the `fixtures` export.
 * @param input.metadata - The raw value of the `metadata` export (optional).
 * @param input.componentName - The component name used in error messages.
 * @returns Parsed and validated fixtures with their metadata.
 * @throws `Error` listing all violations when invalid.
 */
export function parseFixtureFile(input: {
  fixtures: unknown;
  metadata?: unknown;
  componentName: string;
}): { fixtures: VisualFixture[]; metadata: VisualFixtureMetadata } {
  const violations: string[] = [];

  // --- Parse fixtures array ---
  const fixturesResult = z.array(VisualFixtureSchema).safeParse(input.fixtures);
  if (!fixturesResult.success) {
    for (const issue of fixturesResult.error.issues) {
      const path = issue.path.length > 0 ? ` (at ${issue.path.join('.')})` : '';
      violations.push(
        `[${input.componentName}] Fixture validation failed${path}: ${issue.message}`,
      );
    }
  }

  // --- Parse metadata ---
  const metadataResult = VisualFixtureMetadataSchema.safeParse(input.metadata ?? {});
  if (!metadataResult.success) {
    for (const issue of metadataResult.error.issues) {
      const path = issue.path.length > 0 ? ` (at ${issue.path.join('.')})` : '';
      violations.push(
        `[${input.componentName}] Metadata validation failed${path}: ${issue.message}`,
      );
    }
  }

  // --- Cross-cutting checks (only when shape is valid) ---
  if (fixturesResult.success) {
    const fixtures = fixturesResult.data;

    // Uniqueness check: normalize names by lowercasing + trimming, then compare.
    const seen = new Map<string, string>();
    for (const fixture of fixtures) {
      const normalized = fixture.name.toLowerCase().trim();
      const prior = seen.get(normalized);
      if (prior !== undefined) {
        violations.push(
          `[${input.componentName}] Duplicate fixture name: '${fixture.name}' conflicts with '${prior}' after normalization`,
        );
      } else {
        seen.set(normalized, fixture.name);
      }
    }

    // Budget check: more than DEFAULT_FIXTURE_BUDGET fixtures requires an override.
    if (fixtures.length > DEFAULT_FIXTURE_BUDGET) {
      const hasOverride =
        metadataResult.success && metadataResult.data.fixtureBudgetOverride !== undefined;

      if (!hasOverride) {
        violations.push(
          `[${input.componentName}] ${fixtures.length} fixtures exceed the budget of ${DEFAULT_FIXTURE_BUDGET}. ` +
            `Add metadata.fixtureBudgetOverride with a reason and approvedBy.`,
        );
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(violations.join('\n'));
  }

  return {
    fixtures: (fixturesResult as { success: true; data: VisualFixture[] }).data,
    metadata: (metadataResult as { success: true; data: VisualFixtureMetadata }).data,
  };
}
