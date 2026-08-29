import { describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';
import { setupHappyDom } from '../../test/happy-dom.ts';
setupHappyDom();
const { render } = await import('@testing-library/svelte');
const { default: SettingRow } = await import('./setting-row.svelte');
const { default: SettingRowInputFixture } = await import('./setting-row-input-fixture.svelte');

describe('SettingRow', () => {
  test('publishes FormField context to Input, including policy description', () => {
    const { container } = render(SettingRowInputFixture);
    expect(container.querySelector('.cinder-setting-row')).not.toBeNull();
    expect(container.querySelector('#setting')?.getAttribute('aria-describedby')).toBeTruthy();
    expect(container.textContent).toContain('Organization policy');
  });

  test('renders supported Toggle controls in the row', () => {
    const { container } = render(SettingRow, {
      props: {
        id: 'toggle-setting',
        label: 'Enabled',
        control: createRawSnippet(() => ({
          render: () => '<button role="switch" id="toggle-setting"></button>',
        })),
      },
    });
    expect(container.querySelector('.cinder-setting-row')).not.toBeNull();
  });
});
