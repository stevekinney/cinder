import { describe, expect, test } from 'bun:test';
import {
  AmbiguousInteractionTargetError,
  AmbiguousTestIdError,
  applyInteractions,
  DisabledInteractionTargetError,
  HiddenInteractionTargetError,
  InvalidInteractionTargetError,
  MissingInteractionTargetError,
  MissingTestIdError,
  type InteractionLocator,
  type InteractionPage,
} from './interact.ts';

async function expectRejectedWith(
  promise: Promise<unknown>,
  constructor: new (...arguments_: never[]) => Error,
): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(constructor);
    return;
  }
  throw new Error('Expected promise to reject.');
}

async function expectRejectedMessage(promise: Promise<unknown>, message: string): Promise<void> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(Error);
    if (!(error instanceof Error)) throw error;
    expect(error.message).toContain(message);
    return;
  }
  throw new Error('Expected promise to reject.');
}

type LocatorCalls = Array<'focus' | 'click' | 'hover' | `press:${string}`>;

type MockLocatorOptions = {
  count?: number;
  visible?: boolean;
  enabled?: boolean;
  calls?: LocatorCalls;
};

function createLocator(options: MockLocatorOptions = {}): InteractionLocator {
  const calls = options.calls ?? [];
  return {
    count: () => Promise.resolve(options.count ?? 1),
    isVisible: () => Promise.resolve(options.visible ?? true),
    isEnabled: () => Promise.resolve(options.enabled ?? true),
    focus: () => {
      calls.push('focus');
      return Promise.resolve();
    },
    click: () => {
      calls.push('click');
      return Promise.resolve();
    },
    hover: () => {
      calls.push('hover');
      return Promise.resolve();
    },
    press: (key: string) => {
      calls.push(`press:${key}`);
      return Promise.resolve();
    },
  };
}

function createPage(locator: InteractionLocator, resolved: string[] = []): InteractionPage {
  return {
    getByTestId: (testId: string) => {
      resolved.push(`testId:${testId}`);
      return locator;
    },
    getByLabel: (label: string, options?: { exact?: boolean }) => {
      resolved.push(`label:${label}:${String(options?.exact)}`);
      return locator;
    },
    getByRole: (role, options) => {
      resolved.push(`role:${role}:${String(options?.name)}:${String(options?.exact)}`);
      return locator;
    },
  };
}

describe('applyInteractions', () => {
  test('executes steps in order using role, label, and test id locators', async () => {
    const calls: LocatorCalls = [];
    const resolved: string[] = [];
    const page = createPage(createLocator({ calls }), resolved);

    await applyInteractions(page, [
      { action: 'focus', target: { role: 'button', name: 'Save', exact: true } },
      { action: 'click', target: { label: 'Email' } },
      { action: 'hover', target: { testId: 'preview' } },
      { action: 'press', target: { role: 'textbox', name: 'Search' }, key: 'Enter' },
    ]);

    expect(resolved).toEqual([
      'role:button:Save:true',
      'label:Email:undefined',
      'testId:preview',
      'role:textbox:Search:undefined',
    ]);
    expect(calls).toEqual(['focus', 'click', 'hover', 'press:Enter']);
  });

  test('rejects malformed targets before resolving a locator', async () => {
    const page = createPage(createLocator());
    const malformedTarget = { role: 'button', label: 'Save' };

    await expectRejectedWith(
      applyInteractions(page, [{ action: 'click', target: malformedTarget }]),
      InvalidInteractionTargetError,
    );
    await expectRejectedWith(
      applyInteractions(page, [{ action: 'click', target: { role: 'made-up-role' } }]),
      InvalidInteractionTargetError,
    );
  });

  test('reports missing and ambiguous test id targets with dedicated errors', async () => {
    await expectRejectedWith(
      applyInteractions(createPage(createLocator({ count: 0 })), [
        { action: 'click', target: { testId: 'trigger' } },
      ]),
      MissingTestIdError,
    );

    await expectRejectedWith(
      applyInteractions(createPage(createLocator({ count: 2 })), [
        { action: 'click', target: { testId: 'trigger' } },
      ]),
      AmbiguousTestIdError,
    );
  });

  test('reports missing, ambiguous, hidden, and disabled user-facing targets', async () => {
    await expectRejectedWith(
      applyInteractions(createPage(createLocator({ count: 0 })), [
        { action: 'click', target: { role: 'button' } },
      ]),
      MissingInteractionTargetError,
    );

    await expectRejectedWith(
      applyInteractions(createPage(createLocator({ count: 2 })), [
        { action: 'click', target: { role: 'button' } },
      ]),
      AmbiguousInteractionTargetError,
    );

    await expectRejectedWith(
      applyInteractions(createPage(createLocator({ visible: false })), [
        { action: 'hover', target: { role: 'button' } },
      ]),
      HiddenInteractionTargetError,
    );

    await expectRejectedWith(
      applyInteractions(createPage(createLocator({ enabled: false })), [
        { action: 'press', target: { role: 'button' }, key: 'Enter' },
      ]),
      DisabledInteractionTargetError,
    );
  });

  test('requires press steps to provide a key', async () => {
    await expectRejectedMessage(
      applyInteractions(createPage(createLocator()), [
        { action: 'press', target: { role: 'button' } },
      ]),
      "action 'press' requires a non-empty 'key' field",
    );
  });
});
