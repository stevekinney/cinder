import type { Locator, Page } from '@playwright/test';

// The canonical `InteractionStep` lives in the neutral visual-fixture schema.
// The runner consumes the single source of truth rather than duplicating it.
import type { InteractionStep } from '../../../components/scripts/lib/visual-fixtures/schema.ts';

export type InteractionContext = {
  component?: string;
  fixture?: string;
};

function contextPrefix(context: InteractionContext | undefined): string {
  const component = context?.component;
  const fixture = context?.fixture;
  if (component !== undefined && fixture !== undefined) return `${component}/${fixture}: `;
  if (component !== undefined) return `${component}: `;
  if (fixture !== undefined) return `fixture ${fixture}: `;
  return '';
}

type TargetKind = 'testId' | 'label' | 'role';

function hasOwnStringValue(target: Record<string, unknown>, key: TargetKind): boolean {
  return Object.hasOwn(target, key) && typeof target[key] === 'string';
}

function targetKind(
  step: InteractionStep,
  index: number,
  context: InteractionContext | undefined,
): TargetKind {
  const { target } = step;
  if (target === null || typeof target !== 'object') {
    throw new InvalidInteractionTargetError(index, context);
  }

  const record = target as Record<string, unknown>;
  const kinds = (['testId', 'label', 'role'] as const).filter((kind) =>
    hasOwnStringValue(record, kind),
  );

  if (kinds.length !== 1) {
    throw new InvalidInteractionTargetError(index, context);
  }

  return kinds[0]!;
}

function targetDescription(step: InteractionStep): string {
  const { target } = step;
  if ('testId' in target) return `testId "${target.testId}"`;
  if ('label' in target) return `label "${target.label}"`;
  const name = target.name !== undefined ? ` named "${target.name}"` : '';
  return `role "${target.role}"${name}`;
}

export class InvalidInteractionTargetError extends Error {
  readonly step: number;

  constructor(step: number, context?: InteractionContext) {
    super(
      `${contextPrefix(context)}Step ${step}: target must provide exactly one of role, label, or testId.`,
    );
    this.name = 'InvalidInteractionTargetError';
    this.step = step;
  }
}

/**
 * Thrown when no element with the given `data-testid` can be found on the page.
 */
export class MissingTestIdError extends Error {
  /** The testId that could not be resolved. */
  readonly testId: string;
  /** The zero-based index of the step that failed. */
  readonly step: number;

  constructor(testId: string, step: number, context?: InteractionContext) {
    super(`${contextPrefix(context)}Step ${step}: no element found with testId "${testId}".`);
    this.name = 'MissingTestIdError';
    this.testId = testId;
    this.step = step;
  }
}

/**
 * Thrown when more than one element matches the given `data-testid`.
 * Silently picking the first would hide fixture authoring mistakes, so
 * we require every testId used in an interaction step to be unique.
 */
export class AmbiguousTestIdError extends Error {
  /** The testId that matched multiple elements. */
  readonly testId: string;
  /** The zero-based index of the step that failed. */
  readonly step: number;
  /** The number of matching elements that were found. */
  readonly count: number;

  constructor(testId: string, count: number, step: number, context?: InteractionContext) {
    super(
      `${contextPrefix(context)}Step ${step}: testId "${testId}" matched ${count} elements; targets must be unique.`,
    );
    this.name = 'AmbiguousTestIdError';
    this.testId = testId;
    this.step = step;
    this.count = count;
  }
}

export class MissingInteractionTargetError extends Error {
  readonly step: number;

  constructor(description: string, step: number, context?: InteractionContext) {
    super(`${contextPrefix(context)}Step ${step}: no element found for ${description}.`);
    this.name = 'MissingInteractionTargetError';
    this.step = step;
  }
}

export class AmbiguousInteractionTargetError extends Error {
  readonly step: number;
  readonly count: number;

  constructor(description: string, count: number, step: number, context?: InteractionContext) {
    super(
      `${contextPrefix(context)}Step ${step}: ${description} matched ${count} elements; targets must be unique.`,
    );
    this.name = 'AmbiguousInteractionTargetError';
    this.step = step;
    this.count = count;
  }
}

export class HiddenInteractionTargetError extends Error {
  readonly step: number;

  constructor(description: string, step: number, context?: InteractionContext) {
    super(`${contextPrefix(context)}Step ${step}: ${description} is not visible.`);
    this.name = 'HiddenInteractionTargetError';
    this.step = step;
  }
}

export class DisabledInteractionTargetError extends Error {
  readonly step: number;

  constructor(description: string, step: number, context?: InteractionContext) {
    super(`${contextPrefix(context)}Step ${step}: ${description} is disabled.`);
    this.name = 'DisabledInteractionTargetError';
    this.step = step;
  }
}

function locatorForStep(
  page: Page,
  step: InteractionStep,
  index: number,
  context: InteractionContext | undefined,
): Locator {
  const { target } = step;
  const kind = targetKind(step, index, context);
  if (kind === 'testId' && 'testId' in target) return page.getByTestId(target.testId);
  if (kind === 'label' && 'label' in target) {
    return page.getByLabel(target.label, target.exact !== undefined ? { exact: target.exact } : {});
  }

  if (!('role' in target)) {
    throw new InvalidInteractionTargetError(index, context);
  }

  const options =
    target.name !== undefined || target.exact !== undefined
      ? {
          ...(target.name !== undefined ? { name: target.name } : {}),
          ...(target.exact !== undefined ? { exact: target.exact } : {}),
        }
      : {};
  return page.getByRole(target.role as Parameters<Page['getByRole']>[0], options);
}

async function assertResolvable(
  locator: Locator,
  step: InteractionStep,
  index: number,
  context: InteractionContext | undefined,
): Promise<void> {
  const description = targetDescription(step);
  const count = await locator.count();

  if (count === 0) {
    if ('testId' in step.target) throw new MissingTestIdError(step.target.testId, index, context);
    throw new MissingInteractionTargetError(description, index, context);
  }

  if (count > 1) {
    if ('testId' in step.target) {
      throw new AmbiguousTestIdError(step.target.testId, count, index, context);
    }
    throw new AmbiguousInteractionTargetError(description, count, index, context);
  }

  if (!(await locator.isVisible())) {
    throw new HiddenInteractionTargetError(description, index, context);
  }

  if (
    (step.action === 'focus' || step.action === 'click' || step.action === 'press') &&
    !(await locator.isEnabled())
  ) {
    throw new DisabledInteractionTargetError(description, index, context);
  }
}

/**
 * Execute a sequence of interaction steps against a Playwright `Page` in order.
 *
 * Each step is resolved through a user-facing role/name or label locator when
 * possible, with `data-testid` available for fixture-owned hooks. Raw selector
 * strings are intentionally unsupported so fixture targeting stays stable.
 *
 * @throws {MissingTestIdError} when a testId resolves to zero elements.
 * @throws {AmbiguousTestIdError} when a testId resolves to more than one element.
 * @throws {Error} when a `press` step is missing the required `key` field.
 */
export async function applyInteractions(
  page: Page,
  steps: readonly InteractionStep[],
  context?: InteractionContext,
): Promise<void> {
  let index = 0;
  for (const step of steps) {
    const locator = locatorForStep(page, step, index, context);
    await assertResolvable(locator, step, index, context);

    switch (step.action) {
      case 'focus':
        await locator.focus();
        break;

      case 'click':
        await locator.click();
        break;

      case 'hover':
        await locator.hover();
        break;

      case 'press': {
        if (step.key === undefined || step.key === '') {
          throw new Error(
            `${contextPrefix(context)}Step ${index}: action 'press' requires a non-empty 'key' field.`,
          );
        }
        await locator.press(step.key);
        break;
      }
    }

    index += 1;
  }
}
