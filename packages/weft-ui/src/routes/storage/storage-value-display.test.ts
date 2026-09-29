/**
 * Component tests for `<StorageValueDisplay>` (plan §9.6: "Value display via
 * PayloadInspector — values are opaque bytes — handle non-JSON gracefully").
 * No `HttpClient`/query context needed — this component only classifies and
 * renders the `value` prop it's handed, so it's rendered directly rather than
 * through a `.test-harness.svelte` wrapper.
 */
import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import StorageValueDisplay from './storage-value-display.svelte';

describe('StorageValueDisplay', () => {
  test('renders an explicit empty-value message for zero-length bytes', () => {
    const { getByText } = render(StorageValueDisplay, { props: { value: new Uint8Array() } });

    expect(getByText('Empty value (0 bytes).')).not.toBeNull();
  });

  test('renders a binary fallback message for bytes that fail UTF-8 decoding', () => {
    const bytes = new Uint8Array([0xff, 0xfe, 0x80, 0x01]);
    const { getByText } = render(StorageValueDisplay, { props: { value: bytes } });

    expect(getByText(/Binary value/)).not.toBeNull();
    expect(getByText(/not valid UTF-8, cannot be displayed as text/)).not.toBeNull();
  });

  test('renders valid UTF-8 text through PayloadInspector using the default label', () => {
    const bytes = new TextEncoder().encode('{"owner":"ops"}');
    const { getByText } = render(StorageValueDisplay, { props: { value: bytes } });

    expect(getByText('"ops"')).not.toBeNull();
  });

  test('passes a custom label through to PayloadInspector', () => {
    const bytes = new TextEncoder().encode('hello');
    const { getByText } = render(StorageValueDisplay, {
      props: { value: bytes, label: 'app:config' },
    });

    expect(getByText('app:config')).not.toBeNull();
  });
});
