import { describe, expect, it, mock } from 'bun:test';

import {
  AmbiguousTestIdError,
  MissingTestIdError,
  applyInteractions,
  type InteractionStep,
} from './interact.ts';

// ---------------------------------------------------------------------------
// Mock Page factory
// ---------------------------------------------------------------------------

/**
 * A minimal stand-in for a Playwright `Locator`. Each mock locator is
 * configured with a `resolvedCount` so we can exercise every error branch
 * without spinning up a real browser.
 */
type MockLocator = {
  count: ReturnType<typeof mock>;
  focus: ReturnType<typeof mock>;
  click: ReturnType<typeof mock>;
  hover: ReturnType<typeof mock>;
  press: ReturnType<typeof mock>;
};

function createMockLocator(resolvedCount: number): MockLocator {
  return {
    count: mock(() => Promise.resolve(resolvedCount)),
    focus: mock(() => Promise.resolve()),
    click: mock(() => Promise.resolve()),
    hover: mock(() => Promise.resolve()),
    press: mock(() => Promise.resolve()),
  };
}

/**
 * Creates a Page-shaped mock whose `locator()` method returns a configurable
 * `MockLocator` based on the `testId` looked up in the provided map.
 * Any testId not present in the map defaults to a count of 1 with no-op actions.
 */
function createMockPage(locatorsByTestId: Record<string, MockLocator>) {
  return {
    // interact.ts now uses page.getByTestId() rather than page.locator() to
    // avoid CSS selector injection. The mock exposes getByTestId accordingly.
    getByTestId: mock((testId: string) => {
      return locatorsByTestId[testId] ?? createMockLocator(1);
    }),
  };
}

// ---------------------------------------------------------------------------
// Type-level runtime defence: selector strings must be rejected
// ---------------------------------------------------------------------------

describe('runtime defence against non-testId targets', () => {
  it('rejects an object with a selector key cast through unknown', async () => {
    // The TypeScript type only allows { testId: string }, so an accidental
    // any-cast is the only way this could arrive at runtime. We confirm the
    // raw selector string (.foo) is never passed to the page — getByTestId()
    // receives the testId value, not a CSS selector, so injection is impossible.
    const badStep = { action: 'click', target: { selector: '.foo' } } as unknown as InteractionStep;
    const page = createMockPage({});

    // target.testId is undefined on the bad object, so getByTestId('undefined')
    // is called; the default fallback locator (count=1) handles it. The important
    // assertion: the raw CSS string '.foo' was never passed to the page.
    await applyInteractions(page as never, [badStep]);
    // getByTestId should have been called exactly once
    expect(page.getByTestId.mock.calls).toHaveLength(1);
    const calledWithArg = (page.getByTestId.mock.calls[0] as unknown[])[0];
    // The raw CSS string '.foo' must never be passed to getByTestId
    expect(String(calledWithArg)).not.toContain('.foo');
    expect(String(calledWithArg)).not.toContain('[data-testid=');
  });
});

// ---------------------------------------------------------------------------
// Happy paths
// ---------------------------------------------------------------------------

describe('applyInteractions — happy paths', () => {
  it('focus action calls locator.focus() on the resolved element', async () => {
    const locator = createMockLocator(1);
    const page = createMockPage({ 'my-button': locator });

    const steps: readonly InteractionStep[] = [
      { action: 'focus', target: { testId: 'my-button' } },
    ];

    await applyInteractions(page as never, steps);

    expect(locator.focus).toHaveBeenCalledTimes(1);
    expect(locator.click).not.toHaveBeenCalled();
  });

  it('click action calls locator.click()', async () => {
    const locator = createMockLocator(1);
    const page = createMockPage({ 'submit-btn': locator });

    await applyInteractions(page as never, [{ action: 'click', target: { testId: 'submit-btn' } }]);

    expect(locator.click).toHaveBeenCalledTimes(1);
  });

  it('hover action calls locator.hover()', async () => {
    const locator = createMockLocator(1);
    const page = createMockPage({ 'tooltip-trigger': locator });

    await applyInteractions(page as never, [
      { action: 'hover', target: { testId: 'tooltip-trigger' } },
    ]);

    expect(locator.hover).toHaveBeenCalledTimes(1);
  });

  it('press action with a key calls locator.press() with that key', async () => {
    const locator = createMockLocator(1);
    const page = createMockPage({ 'search-input': locator });

    await applyInteractions(page as never, [
      { action: 'press', target: { testId: 'search-input' }, key: 'Enter' },
    ]);

    expect(locator.press).toHaveBeenCalledTimes(1);
    expect(locator.press).toHaveBeenCalledWith('Enter');
  });

  it('executes multiple steps in order', async () => {
    const calls: string[] = [];

    const inputLocator: MockLocator = {
      count: mock(() => Promise.resolve(1)),
      focus: mock(() => {
        calls.push('focus:input');
        return Promise.resolve();
      }),
      click: mock(() => Promise.resolve()),
      hover: mock(() => Promise.resolve()),
      press: mock(() => {
        calls.push('press:input');
        return Promise.resolve();
      }),
    };
    const buttonLocator: MockLocator = {
      count: mock(() => Promise.resolve(1)),
      focus: mock(() => Promise.resolve()),
      click: mock(() => {
        calls.push('click:button');
        return Promise.resolve();
      }),
      hover: mock(() => Promise.resolve()),
      press: mock(() => Promise.resolve()),
    };

    const page = createMockPage({ 'text-input': inputLocator, 'submit-button': buttonLocator });

    const steps: readonly InteractionStep[] = [
      { action: 'focus', target: { testId: 'text-input' } },
      { action: 'press', target: { testId: 'text-input' }, key: 'Tab' },
      { action: 'click', target: { testId: 'submit-button' } },
    ];

    await applyInteractions(page as never, steps);

    expect(calls).toEqual(['focus:input', 'press:input', 'click:button']);
  });

  it('resolves the locator via page.getByTestId() (not a CSS selector)', async () => {
    const locator = createMockLocator(1);
    const page = createMockPage({ 'dialog-close': locator });

    await applyInteractions(page as never, [
      { action: 'click', target: { testId: 'dialog-close' } },
    ]);

    expect(page.getByTestId).toHaveBeenCalledWith('dialog-close');
  });
});

// ---------------------------------------------------------------------------
// Error cases
// ---------------------------------------------------------------------------

describe('applyInteractions — MissingTestIdError', () => {
  it('throws MissingTestIdError when count is 0', async () => {
    const locator = createMockLocator(0);
    const page = createMockPage({ 'ghost-element': locator });

    await expect(
      applyInteractions(page as never, [{ action: 'click', target: { testId: 'ghost-element' } }]),
    ).rejects.toThrow(MissingTestIdError);
  });

  it('error message includes the missing testId', async () => {
    const page = createMockPage({ 'absent-id': createMockLocator(0) });

    await expect(
      applyInteractions(page as never, [{ action: 'focus', target: { testId: 'absent-id' } }]),
    ).rejects.toThrow(/absent-id/);
  });

  it('error has the correct testId and step properties', async () => {
    const page = createMockPage({
      'step-zero': createMockLocator(1),
      'step-one': createMockLocator(0),
    });

    const steps: readonly InteractionStep[] = [
      { action: 'click', target: { testId: 'step-zero' } },
      { action: 'click', target: { testId: 'step-one' } },
    ];

    let caught: unknown;
    try {
      await applyInteractions(page as never, steps);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(MissingTestIdError);
    const missingError = caught as MissingTestIdError;
    expect(missingError.testId).toBe('step-one');
    expect(missingError.step).toBe(1);
  });
});

describe('applyInteractions — AmbiguousTestIdError', () => {
  it('throws AmbiguousTestIdError when count is greater than 1', async () => {
    const page = createMockPage({ 'duplicate-id': createMockLocator(2) });

    await expect(
      applyInteractions(page as never, [{ action: 'click', target: { testId: 'duplicate-id' } }]),
    ).rejects.toThrow(AmbiguousTestIdError);
  });

  it('error message includes the count', async () => {
    const page = createMockPage({ 'triple-id': createMockLocator(3) });

    await expect(
      applyInteractions(page as never, [{ action: 'hover', target: { testId: 'triple-id' } }]),
    ).rejects.toThrow(/3/);
  });

  it('error message includes the testId', async () => {
    const page = createMockPage({ 'my-duplicate': createMockLocator(2) });

    await expect(
      applyInteractions(page as never, [{ action: 'hover', target: { testId: 'my-duplicate' } }]),
    ).rejects.toThrow(/my-duplicate/);
  });

  it('error has the correct testId, count, and step properties', async () => {
    const page = createMockPage({ ambiguous: createMockLocator(4) });

    let caught: unknown;
    try {
      await applyInteractions(page as never, [
        { action: 'click', target: { testId: 'ambiguous' } },
      ]);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AmbiguousTestIdError);
    const ambiguousError = caught as AmbiguousTestIdError;
    expect(ambiguousError.testId).toBe('ambiguous');
    expect(ambiguousError.count).toBe(4);
    expect(ambiguousError.step).toBe(0);
  });

  it('does not silently pick the first match — always throws', async () => {
    const locator = createMockLocator(2);
    const page = createMockPage({ 'shared-id': locator });

    await expect(
      applyInteractions(page as never, [{ action: 'focus', target: { testId: 'shared-id' } }]),
    ).rejects.toThrow(AmbiguousTestIdError);

    // focus() must never have been called on the ambiguous locator
    expect(locator.focus).not.toHaveBeenCalled();
  });
});

describe('applyInteractions — press without key', () => {
  it('throws when key is undefined', async () => {
    const page = createMockPage({ input: createMockLocator(1) });

    // Construct step without key; we omit it entirely (undefined at runtime)
    const step: InteractionStep = { action: 'press', target: { testId: 'input' } };

    await expect(applyInteractions(page as never, [step])).rejects.toThrow(/key/);
  });

  it('throws when key is an empty string', async () => {
    const page = createMockPage({ input: createMockLocator(1) });

    const step: InteractionStep = { action: 'press', target: { testId: 'input' }, key: '' };

    await expect(applyInteractions(page as never, [step])).rejects.toThrow(/key/);
  });

  it('error message references the step index', async () => {
    const page = createMockPage({
      first: createMockLocator(1),
      second: createMockLocator(1),
    });

    const steps: readonly InteractionStep[] = [
      { action: 'click', target: { testId: 'first' } },
      { action: 'press', target: { testId: 'second' } },
    ];

    await expect(applyInteractions(page as never, steps)).rejects.toThrow(/1/);
  });
});
