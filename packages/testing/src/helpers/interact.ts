import type { Page } from '@playwright/test';

// TODO: Replace this local definition with the import from '../fixtures/fixture-schema.ts'
// once P2a lands. The shape must remain compatible: { action, target: { testId }, key? }.
/**
 * A single interaction step that can be applied to a Playwright page.
 * The `key` field is only meaningful when `action` is `'press'`.
 */
export type InteractionStep = {
  action: 'focus' | 'click' | 'hover' | 'press';
  target: { testId: string };
  key?: string;
};

/**
 * Thrown when no element with the given `data-testid` can be found on the page.
 */
export class MissingTestIdError extends Error {
  /** The testId that could not be resolved. */
  readonly testId: string;
  /** The zero-based index of the step that failed. */
  readonly step: number;

  constructor(testId: string, step: number) {
    super(`Step ${step}: no element found with [data-testid="${testId}"].`);
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

  constructor(testId: string, count: number, step: number) {
    super(
      `Step ${step}: [data-testid="${testId}"] matched ${count} elements — testIds must be unique.`,
    );
    this.name = 'AmbiguousTestIdError';
    this.testId = testId;
    this.step = step;
    this.count = count;
  }
}

/**
 * Execute a sequence of interaction steps against a Playwright `Page` in order.
 *
 * Each step is resolved by locating `[data-testid="<step.target.testId>"]`.
 * Selector strings are intentionally unsupported — all targeting must go through
 * `data-testid` so tests remain decoupled from visual structure.
 *
 * @throws {MissingTestIdError} when a testId resolves to zero elements.
 * @throws {AmbiguousTestIdError} when a testId resolves to more than one element.
 * @throws {Error} when a `press` step is missing the required `key` field.
 */
export async function applyInteractions(
  page: Page,
  steps: readonly InteractionStep[],
): Promise<void> {
  let index = 0;
  for (const step of steps) {
    const { testId } = step.target;
    const locator = page.locator(`[data-testid="${testId}"]`);

    const count = await locator.count();

    if (count === 0) {
      throw new MissingTestIdError(testId, index);
    }

    if (count > 1) {
      throw new AmbiguousTestIdError(testId, count, index);
    }

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
          throw new Error(`Step ${index}: action 'press' requires a non-empty 'key' field.`);
        }
        await locator.press(step.key);
        break;
      }
    }

    index += 1;
  }
}
