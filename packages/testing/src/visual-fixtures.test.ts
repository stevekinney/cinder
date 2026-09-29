import { describe, expect, test } from 'bun:test';

import { fixtureRenderMode, parseFixtureFile } from './visual-fixtures.ts';

describe('parseFixtureFile', () => {
  test('parses direct and host fixtures with default categories', () => {
    const result = parseFixtureFile({
      componentName: 'Button',
      fixtures: [
        { name: 'primary', props: { label: 'Save' } },
        { name: 'remote', host: '/fixtures/button' },
      ],
    });

    expect(result.metadata).toEqual({});
    expect(result.fixtures.map((fixture) => fixture.category)).toEqual([
      'visual-contract',
      'visual-contract',
    ]);
    expect(result.fixtures.map(fixtureRenderMode)).toEqual(['direct', 'host']);
  });

  test('defaults interactive fixtures to the interaction-state category', () => {
    const result = parseFixtureFile({
      componentName: 'Menu',
      fixtures: [
        {
          name: 'open',
          props: {},
          interact: [{ action: 'click', target: { role: 'button', name: 'Open' } }],
        },
      ],
    });

    expect(result.fixtures[0]?.category).toBe('interaction-state');
  });

  test('rejects duplicate and derived resting-state fixture name collisions', () => {
    expect(() =>
      parseFixtureFile({
        componentName: 'Dialog',
        fixtures: [
          {
            name: 'open',
            props: {},
            interact: [{ action: 'hover', target: { testId: 'trigger' } }],
          },
          { name: 'open-resting', props: {} },
        ],
      }),
    ).toThrow("Fixture name 'open-resting' conflicts with the derived resting-state fixture");
  });

  test('requires an audited fixture budget override when the budget is exceeded', () => {
    const fixtures = Array.from({ length: 6 }, (_, index) => ({
      name: `state-${index}`,
      props: {},
    }));

    expect(() => parseFixtureFile({ componentName: 'Tabs', fixtures })).toThrow(
      '6 fixtures exceed the budget of 5',
    );

    expect(
      parseFixtureFile({
        componentName: 'Tabs',
        fixtures,
        metadata: { fixtureBudgetOverride: { reason: 'Documented matrix', approvedBy: 'CIN' } },
      }).fixtures,
    ).toHaveLength(6);
  });

  test('requires a key for press interactions', () => {
    expect(() =>
      parseFixtureFile({
        componentName: 'Combobox',
        fixtures: [
          {
            name: 'keyboard',
            props: {},
            interact: [{ action: 'press', target: { label: 'Search' } }],
          },
        ],
      }),
    ).toThrow("The 'key' field is required");
  });
});
