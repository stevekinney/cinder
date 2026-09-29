import { z } from 'zod';

export const FIXTURE_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;
export const FIXTURE_NAME_MAX_LENGTH = 40;
export const RESERVED_FIXTURE_NAMES = ['default'] as const;
export const DEFAULT_FIXTURE_BUDGET = 5;
export const DEFAULT_MASK_MAX_AREA_PERCENT = 10;

export const MASK_REASONS = [
  'timestamp',
  'generated-id',
  'external-avatar',
  'rng-content',
] as const;

export const INTERACTION_ACTIONS = ['focus', 'click', 'hover', 'press'] as const;

export const FIXTURE_CATEGORIES = [
  'visual-contract',
  'primitive-composition',
  'interaction-state',
  'documentation',
] as const;

export type FixtureCategory = (typeof FIXTURE_CATEGORIES)[number];

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

const RoleTargetSchema = z
  .object({
    role: z.string().min(1),
    name: z.string().min(1).optional(),
    exact: z.boolean().optional(),
  })
  .strict();

const LabelTargetSchema = z
  .object({
    label: z.string().min(1),
    exact: z.boolean().optional(),
  })
  .strict();

const TestIdTargetSchema = z
  .object({
    testId: z.string().min(1),
  })
  .strict();

export const InteractionTargetSchema = z.union([
  RoleTargetSchema,
  LabelTargetSchema,
  TestIdTargetSchema,
]);

export const InteractionStepSchema = z
  .object({
    action: z.enum(INTERACTION_ACTIONS),
    target: InteractionTargetSchema,
    key: z.string().min(1).optional(),
  })
  .strict()
  .refine((step) => step.action !== 'press' || (step.key !== undefined && step.key.length > 0), {
    message: "The 'key' field is required and must be non-empty when action is 'press'.",
    path: ['key'],
  });

export const MaskRuleSchema = z
  .object({
    testId: z.string().min(1),
    reason: z.enum(MASK_REASONS),
    maxAreaPercent: z.number().gt(0).lte(DEFAULT_MASK_MAX_AREA_PERCENT),
  })
  .strict();

const SharedFixtureSchema = z.object({
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
  interact: z.array(InteractionStepSchema).optional(),
  mask: z.array(MaskRuleSchema).optional(),
  category: z.enum(FIXTURE_CATEGORIES).optional(),
});

const DirectFixtureSchema = SharedFixtureSchema.extend({
  props: JsonValueSchema,
  host: z.never().optional(),
}).strict();

const HostFixtureSchema = SharedFixtureSchema.extend({
  host: z.string().min(1),
  props: JsonValueSchema.optional(),
}).strict();

export const VisualFixtureSchema = z
  .union([DirectFixtureSchema, HostFixtureSchema])
  .transform((fixture) => ({
    ...fixture,
    category:
      fixture.category ??
      (fixture.interact && fixture.interact.length > 0
        ? ('interaction-state' as const)
        : ('visual-contract' as const)),
  }));

export const VisualFixtureMetadataSchema = z
  .object({
    fixtureBudgetOverride: z
      .object({
        reason: z.string().min(1),
        approvedBy: z.string().min(1),
      })
      .strict()
      .optional(),
  })
  .strict();

export type VisualFixture = z.infer<typeof VisualFixtureSchema>;
export type DirectVisualFixture = Extract<VisualFixture, { props: JsonValue; host?: never }>;
export type HostVisualFixture = Extract<VisualFixture, { host: string }>;
export type VisualFixtureMetadata = z.infer<typeof VisualFixtureMetadataSchema>;
export type InteractionStep = z.infer<typeof InteractionStepSchema>;
export type InteractionTarget = z.infer<typeof InteractionTargetSchema>;
export type MaskRule = z.infer<typeof MaskRuleSchema>;

export function fixtureRenderMode(fixture: VisualFixture): 'direct' | 'host' {
  return 'host' in fixture && typeof fixture.host === 'string' ? 'host' : 'direct';
}

function collectZodIssues(prefix: string, result: z.ZodSafeParseResult<unknown>): string[] {
  if (result.success) return [];
  return result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? ` (at ${issue.path.join('.')})` : '';
    return `${prefix}${path}: ${issue.message}`;
  });
}

function duplicateFixtureViolations(
  fixtures: readonly VisualFixture[],
  componentName: string,
): {
  seen: Map<string, string>;
  violations: string[];
} {
  const seen = new Map<string, string>();
  const violations: string[] = [];

  for (const fixture of fixtures) {
    const normalized = fixture.name.toLowerCase().trim();
    const prior = seen.get(normalized);
    if (prior !== undefined) {
      violations.push(
        `[${componentName}] Duplicate fixture name: '${fixture.name}' conflicts with '${prior}' after normalization`,
      );
    } else {
      seen.set(normalized, fixture.name);
    }
  }

  return { seen, violations };
}

function restingFixtureViolations(
  fixtures: readonly VisualFixture[],
  seen: ReadonlyMap<string, string>,
  componentName: string,
): string[] {
  return fixtures.flatMap((fixture) => {
    if (fixture.interact === undefined || fixture.interact.length === 0) return [];
    const conflictingFixture = seen.get(`${fixture.name}-resting`);
    return conflictingFixture === undefined
      ? []
      : [
          `[${componentName}] Fixture name '${conflictingFixture}' conflicts with the derived resting-state fixture for '${fixture.name}'`,
        ];
  });
}

function budgetViolation(
  fixtures: readonly VisualFixture[],
  metadata: VisualFixtureMetadata | undefined,
  componentName: string,
): string | undefined {
  if (fixtures.length <= DEFAULT_FIXTURE_BUDGET || metadata?.fixtureBudgetOverride !== undefined) {
    return undefined;
  }

  return (
    `[${componentName}] ${fixtures.length} fixtures exceed the budget of ${DEFAULT_FIXTURE_BUDGET}. ` +
    'Add metadata.fixtureBudgetOverride with a reason and approvedBy.'
  );
}

export function parseFixtureFile(input: {
  fixtures: unknown;
  metadata?: unknown;
  componentName: string;
}): { fixtures: VisualFixture[]; metadata: VisualFixtureMetadata } {
  const fixturesResult = z.array(VisualFixtureSchema).safeParse(input.fixtures);
  const metadataResult = VisualFixtureMetadataSchema.safeParse(input.metadata ?? {});
  const violations = [
    ...collectZodIssues(`[${input.componentName}] Fixture validation failed`, fixturesResult),
    ...collectZodIssues(`[${input.componentName}] Metadata validation failed`, metadataResult),
  ];

  if (fixturesResult.success) {
    const duplicateResult = duplicateFixtureViolations(fixturesResult.data, input.componentName);
    violations.push(...duplicateResult.violations);
    violations.push(
      ...restingFixtureViolations(fixturesResult.data, duplicateResult.seen, input.componentName),
    );

    const overBudget = budgetViolation(
      fixturesResult.data,
      metadataResult.success ? metadataResult.data : undefined,
      input.componentName,
    );
    if (overBudget !== undefined) violations.push(overBudget);
  }

  if (violations.length > 0) throw new Error(violations.join('\n'));

  if (!fixturesResult.success || !metadataResult.success) {
    throw new Error(`[${input.componentName}] fixture parsing failed unexpectedly.`);
  }

  return {
    fixtures: fixturesResult.data,
    metadata: metadataResult.data,
  };
}
