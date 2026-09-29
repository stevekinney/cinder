import { requireElement } from '../../../../tests/dom-test-support.ts';

import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import AdvancedOptions from './advanced-options.svelte';
import { EMPTY_ADVANCED_START_OPTIONS } from './start-wizard-state.ts';

describe('AdvancedOptions', () => {
  test('renders the collapsible trigger', async () => {
    const { getByText } = render(AdvancedOptions, {
      props: { value: EMPTY_ADVANCED_START_OPTIONS, onChange: () => {} },
    });

    expect(getByText('Advanced options')).not.toBeNull();
  });

  // `open: true` renders the panel already expanded rather than simulating
  // a click through the trigger — Cinder's `Collapsible` toggles via a
  // Svelte `transition:` directive whose lifecycle event dispatch happy-dom
  // can't construct cross-realm (a pre-existing gap in this project's test
  // preload: no test anywhere in the repo currently drives a transitioning
  // Cinder trigger via `fireEvent.click`; `fault-boundary.test.ts` notes it
  // sidesteps the same component for the same reason). `open` is exposed as
  // a real bindable prop specifically so tests (and any future "expand all"
  // caller) don't need to.
  test('editing the id field calls onChange with the updated value', async () => {
    let latest = EMPTY_ADVANCED_START_OPTIONS;
    const { getByLabelText } = render(AdvancedOptions, {
      props: {
        value: EMPTY_ADVANCED_START_OPTIONS,
        open: true,
        onChange: (next) => {
          latest = next;
        },
      },
    });

    const idInput = requireElement(getByLabelText('Workflow id'), HTMLInputElement);
    await fireEvent.input(idInput, { target: { value: 'my-run' } });

    expect(latest.id).toBe('my-run');
  });

  test('"Add attribute" appends a blank row', async () => {
    let latest = EMPTY_ADVANCED_START_OPTIONS;
    const { getByRole } = render(AdvancedOptions, {
      props: {
        value: EMPTY_ADVANCED_START_OPTIONS,
        open: true,
        onChange: (next) => {
          latest = next;
        },
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Add attribute' }));

    expect(latest.searchAttributes).toEqual([{ key: '', value: '' }]);
  });
});
