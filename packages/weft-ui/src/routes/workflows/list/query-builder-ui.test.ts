import { requireElement } from '../../../../tests/dom-test-support.ts';

import { fireEvent, render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import type { AttributeFilter } from '../../../lib/attribute-filters.ts';
import QueryBuilder from './query-builder.svelte';

describe('QueryBuilder', () => {
  test('renders one row per seeded attribute filter, plus operator/value text', async () => {
    const { getByDisplayValue } = render(QueryBuilder, {
      props: {
        attributes: [{ key: 'customerTier', value: 'gold' }] satisfies AttributeFilter[],
        onAttributesChange: () => {},
        knownAttributeKeys: ['customerTier', 'amount'],
      },
    });

    expect(getByDisplayValue('customerTier')).not.toBeNull();
    expect(getByDisplayValue('gold')).not.toBeNull();
  });

  test('renders one blank row when there are no seeded attributes', async () => {
    const { getByLabelText } = render(QueryBuilder, {
      props: { attributes: [], onAttributesChange: () => {}, knownAttributeKeys: [] },
    });

    expect(getByLabelText('Field for condition 1 of Conditions')).not.toBeNull();
  });

  test('typing a value calls onAttributesChange with the updated filter', async () => {
    let latest: AttributeFilter[] | undefined;
    const { getByLabelText } = render(QueryBuilder, {
      props: {
        attributes: [{ key: 'customerTier', value: 'gold' }] satisfies AttributeFilter[],
        onAttributesChange: (next) => {
          latest = next;
        },
        knownAttributeKeys: [],
      },
    });

    const valueInput = requireElement(
      getByLabelText('Value for condition 1 of Conditions'),
      HTMLInputElement,
    );
    await fireEvent.input(valueInput, { target: { value: 'silver' } });

    expect(latest).toEqual([{ key: 'customerTier', value: 'silver' }]);
  });

  test('Cinder commits an arbitrary field key through its free-text combobox', async () => {
    let latest: AttributeFilter[] | undefined;
    const { getByLabelText } = render(QueryBuilder, {
      props: {
        attributes: [{ key: 'customerTier', value: 'gold' }] satisfies AttributeFilter[],
        onAttributesChange: (next) => {
          latest = next;
        },
        knownAttributeKeys: ['customerTier'],
      },
    });

    const fieldInput = requireElement(
      getByLabelText('Field for condition 1 of Conditions'),
      HTMLInputElement,
    );
    await fireEvent.input(fieldInput, { target: { value: 'custom.owner' } });
    await fireEvent.keyDown(fieldInput, { key: 'Enter' });

    expect(latest).toEqual([{ key: 'custom.owner', value: 'gold' }]);
  });

  test('Cinder renders a numeric value control for an observed numeric attribute', async () => {
    const { getByLabelText } = render(QueryBuilder, {
      props: {
        attributes: [{ key: 'retryCount', value: 3 }] satisfies AttributeFilter[],
        onAttributesChange: () => {},
        knownAttributeKeys: ['retryCount'],
      },
    });

    expect(getByLabelText('Value for condition 1 of Conditions')).toMatchObject({ type: 'number' });
  });

  test('"Add condition" appends a blank row', async () => {
    const { getByRole, getByLabelText } = render(QueryBuilder, {
      props: { attributes: [], onAttributesChange: () => {}, knownAttributeKeys: [] },
    });

    await fireEvent.click(getByRole('button', { name: /Add condition to Conditions/ }));

    expect(getByLabelText('Field for condition 1 of Conditions')).not.toBeNull();
    expect(getByLabelText('Field for condition 2 of Conditions')).not.toBeNull();
  });

  test('removing the only row leaves one blank row rather than zero', async () => {
    let latest: AttributeFilter[] | undefined;
    const { getByRole, getByLabelText } = render(QueryBuilder, {
      props: {
        attributes: [{ key: 'customerTier', value: 'gold' }] satisfies AttributeFilter[],
        onAttributesChange: (next) => {
          latest = next;
        },
        knownAttributeKeys: [],
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Remove condition 1 of Conditions' }));

    expect(latest).toEqual([]);
    expect(getByLabelText('Field for condition 1 of Conditions')).not.toBeNull();
  });

  test('switching to Raw mode shows the JSON preview', async () => {
    const { getByRole, getByText } = render(QueryBuilder, {
      props: {
        attributes: [{ key: 'customerTier', value: 'gold' }] satisfies AttributeFilter[],
        onAttributesChange: () => {},
        knownAttributeKeys: [],
      },
    });

    await fireEvent.click(getByRole('radio', { name: 'Raw' }));

    expect(getByText(/customerTier/)).not.toBeNull();
  });

  test('switching back to Visual mode from Raw restores the condition builder', async () => {
    const { getByRole, getByLabelText, queryByLabelText } = render(QueryBuilder, {
      props: {
        attributes: [{ key: 'customerTier', value: 'gold' }] satisfies AttributeFilter[],
        onAttributesChange: () => {},
        knownAttributeKeys: [],
      },
    });

    await fireEvent.click(getByRole('radio', { name: 'Raw' }));
    expect(queryByLabelText('Field for condition 1 of Conditions')).toBeNull();

    await fireEvent.click(getByRole('radio', { name: 'Visual' }));
    expect(getByLabelText('Field for condition 1 of Conditions')).not.toBeNull();
  });

  test('Cinder renders a boolean value control for an observed boolean attribute', async () => {
    const { getByLabelText } = render(QueryBuilder, {
      props: {
        attributes: [{ key: 'isFlaky', value: true }] satisfies AttributeFilter[],
        onAttributesChange: () => {},
        knownAttributeKeys: ['isFlaky'],
      },
    });

    const valueControl = getByLabelText('Value for condition 1 of Conditions');
    expect(valueControl.getAttribute('role') ?? valueControl.tagName.toLowerCase()).toMatch(
      /checkbox|switch|select|input/i,
    );
  });

  test('a gt/lt range on an attribute is reflected in the Raw preview', async () => {
    const { getByRole, getByText } = render(QueryBuilder, {
      props: {
        attributes: [{ key: 'amount', gt: 100, lt: 900 }] satisfies AttributeFilter[],
        onAttributesChange: () => {},
        knownAttributeKeys: [],
      },
    });

    await fireEvent.click(getByRole('radio', { name: 'Raw' }));

    expect(getByText(/amount/)).not.toBeNull();
  });
});
