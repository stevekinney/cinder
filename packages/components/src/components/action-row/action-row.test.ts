/// <reference lib="dom" />
import { describe, expect, mock, test } from 'bun:test';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { fireEvent, render } = await import('@testing-library/svelte');
const { default: ActionRow } = await import('./action-row.svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

describe('ActionRow', () => {
  test('renders a full-width native button row with content regions', () => {
    const { container } = render(ActionRow, {
      props: {
        leading: textSnippet('leading'),
        title: textSnippet('Primary row'),
        description: textSnippet('Description text'),
        meta: textSnippet('Updated now'),
        trailing: textSnippet('trailing'),
      },
    });

    const row = container.querySelector('.cinder-action-row');
    expect(row?.tagName).toBe('BUTTON');
    expect(row?.getAttribute('type')).toBe('button');
    expect(row?.querySelector('.cinder-action-row__leading')?.textContent).toContain('leading');
    expect(row?.querySelector('.cinder-action-row__title')?.textContent).toContain('Primary row');
    expect(row?.querySelector('.cinder-action-row__description')?.textContent).toContain(
      'Description text',
    );
    expect(row?.querySelector('.cinder-action-row__meta')?.textContent).toContain('Updated now');
    expect(row?.querySelector('.cinder-action-row__trailing')?.textContent).toContain('trailing');
  });

  test('maps selected state to aria-pressed by default', () => {
    const { container } = render(ActionRow, {
      props: { selected: true, title: textSnippet('Selected run') },
    });

    const row = container.querySelector('.cinder-action-row');
    expect(row?.getAttribute('aria-pressed')).toBe('true');
    expect(row?.getAttribute('aria-current')).toBeNull();
    expect(row?.getAttribute('data-cinder-selected')).toBe('');
  });

  test('maps current selected state to aria-current', () => {
    const { container } = render(ActionRow, {
      props: {
        selected: true,
        selectedState: 'current',
        currentValue: 'step',
        title: textSnippet('Current step'),
      },
    });

    const row = container.querySelector('.cinder-action-row');
    expect(row?.getAttribute('aria-current')).toBe('step');
    expect(row?.getAttribute('aria-pressed')).toBeNull();
  });

  test('omits aria-current when current mode is not selected', () => {
    const { container } = render(ActionRow, {
      props: {
        selected: false,
        selectedState: 'current',
        title: textSnippet('Other step'),
      },
    });

    const row = container.querySelector('.cinder-action-row');
    expect(row?.getAttribute('aria-current')).toBeNull();
    expect(row?.getAttribute('aria-pressed')).toBeNull();
    expect(row?.getAttribute('data-cinder-selected')).toBeNull();
  });

  test('clicking the row calls the consumer handler', async () => {
    const onclick = mock();
    const { container } = render(ActionRow, {
      props: { onclick, title: textSnippet('Clickable run') },
    });

    const row = container.querySelector('.cinder-action-row') as HTMLButtonElement;
    await fireEvent.click(row);

    expect(onclick).toHaveBeenCalledTimes(1);
  });

  test('disabled rows keep native disabled behavior', async () => {
    const onclick = mock();
    const { container } = render(ActionRow, {
      props: { disabled: true, onclick, title: textSnippet('Disabled run') },
    });

    const row = container.querySelector('.cinder-action-row') as HTMLButtonElement;
    expect(row.disabled).toBe(true);
    await fireEvent.click(row);
    expect(onclick).not.toHaveBeenCalled();
  });

  test('density and custom class are surfaced on the root button', () => {
    const { container } = render(ActionRow, {
      props: {
        density: 'condensed',
        class: 'timeline-row',
        title: textSnippet('Dense row'),
      },
    });

    const row = container.querySelector('.cinder-action-row');
    expect(row?.getAttribute('data-cinder-density')).toBe('condensed');
    expect(row?.classList.contains('timeline-row')).toBe(true);
  });
});
