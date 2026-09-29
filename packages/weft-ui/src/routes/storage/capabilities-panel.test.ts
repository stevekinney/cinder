/**
 * Component tests for `<CapabilitiesPanel>` (plan §9.6): the honest
 * derivable/undiscoverable split (module doc comment) across the three
 * `conditionalBatchSupported` states.
 */
import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import CapabilitiesPanel from './capabilities-panel.svelte';

describe('CapabilitiesPanel', () => {
  test('batch operations is always supported', async () => {
    const { getAllByText } = render(CapabilitiesPanel, {
      props: { conditionalBatchSupported: true },
    });

    expect(getAllByText('Batch operations').length).toBeGreaterThan(0);
    expect(getAllByText('supported').length).toBeGreaterThan(0);
  });

  test('shows "checking…" while the probe is pending (undefined)', async () => {
    const { getByText } = render(CapabilitiesPanel, {
      props: { conditionalBatchSupported: undefined },
    });

    expect(getByText('checking…')).not.toBeNull();
  });

  test('shows "not supported" when the probe resolves false', async () => {
    const { getByText } = render(CapabilitiesPanel, {
      props: { conditionalBatchSupported: false },
    });

    expect(getByText('not supported')).not.toBeNull();
  });

  test('links to the upstream capabilities-operation issue', async () => {
    const { getByRole } = render(CapabilitiesPanel, { props: { conditionalBatchSupported: true } });

    const link = getByRole('link', { name: /weft#727/ });
    expect(link.getAttribute('href')).toBe('https://github.com/stevekinney/weft/issues/727');
  });
});
