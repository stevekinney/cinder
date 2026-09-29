import { render } from '@testing-library/svelte';
import { describe, expect, test } from 'bun:test';

import LogsTab from './logs-tab.svelte';

describe('LogsTab', () => {
  test('renders an honest empty state naming the deliberate boundary rather than fake data', async () => {
    const { getByText } = render(LogsTab);

    expect(getByText("Logs aren't available over the API")).not.toBeNull();
    expect(getByText(/EngineOptions.onLog/)).not.toBeNull();
    expect(getByText(/intentional/)).not.toBeNull();
  });
});
