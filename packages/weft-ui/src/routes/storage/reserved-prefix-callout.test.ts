/**
 * Component tests for `<ReservedPrefixCallout>` (plan §9.6: "inline input warning").
 */
import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import ReservedPrefixCallout from './reserved-prefix-callout.svelte';

describe('ReservedPrefixCallout', () => {
  test('renders nothing for an application key', async () => {
    const { container } = render(ReservedPrefixCallout, {
      props: { key: 'app:my-service:session' },
    });

    expect(container.textContent?.trim()).toBe('');
  });

  test('renders nothing for the empty key', async () => {
    const { container } = render(ReservedPrefixCallout, { props: { key: '' } });

    expect(container.textContent?.trim()).toBe('');
  });

  test('names the matched prefix for a reserved key', async () => {
    const { getByText } = render(ReservedPrefixCallout, { props: { key: 'wf:order-123' } });

    expect(getByText('wf:')).not.toBeNull();
    expect(getByText(/reserved prefix/)).not.toBeNull();
  });

  test('updates when the key prop changes', async () => {
    const { container, queryByText, rerender } = render(ReservedPrefixCallout, {
      props: { key: 'app:ok' },
    });
    expect(container.textContent?.trim()).toBe('');

    await rerender({ key: 'lease:engine' });
    expect(queryByText(/reserved prefix/)).not.toBeNull();
  });
});
