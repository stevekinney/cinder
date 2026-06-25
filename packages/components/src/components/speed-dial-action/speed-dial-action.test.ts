/// <reference lib="dom" />
import { afterEach, describe, expect, mock, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: SpeedDialAction } = await import('./speed-dial-action.svelte');
const { default: SpeedDialActionFixture } = await import('./speed-dial-action.fixture.svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

async function flushQueuedFocus(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('SpeedDialAction', () => {
  test('throws a clear error outside a SpeedDial parent', () => {
    const icon = createRawSnippet(() => ({
      render: () => '<span aria-hidden="true">C</span>',
    }));

    expect(() =>
      render(SpeedDialAction, {
        props: {
          label: 'Create',
          icon,
        },
      }),
    ).toThrow('SpeedDial.Action must be rendered inside a SpeedDial parent.');
  });

  test('threads label placement and closes through the parent after activation', async () => {
    const onAction = mock(() => {});
    const { container } = render(SpeedDialActionFixture, {
      props: { labelPlacement: 'start', onAction },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Quick actions' }));
    await flushQueuedFocus();
    await fireEvent.click(screen.getByRole('button', { name: 'Create' }));
    await flushQueuedFocus();

    const action = container.querySelector('.cinder-speed-dial-action');
    expect(action?.getAttribute('data-cinder-label-placement')).toBe('start');
    expect(action?.hasAttribute('data-cinder-open')).toBe(false);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Quick actions' }));
  });

  test('visible label activates the underlying action button', async () => {
    const onAction = mock(() => {});
    render(SpeedDialActionFixture, {
      props: { labelPlacement: 'start', onAction },
    });

    await fireEvent.click(screen.getByRole('button', { name: 'Quick actions' }));
    await flushQueuedFocus();
    await fireEvent.click(screen.getByText('Create'));
    await flushQueuedFocus();

    expect(onAction).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('group', { name: 'Quick actions' }).hasAttribute('data-cinder-open'),
    ).toBe(false);
  });

  test('omits the visible label when labelPlacement is none', () => {
    const { container } = render(SpeedDialActionFixture, {
      props: { labelPlacement: 'none' },
    });

    expect(container.querySelector('.cinder-speed-dial-action__label')).toBeNull();
  });

  test('flat index import is SSR-safe', async () => {
    const module = await import('./index.ts');
    expect(typeof module.default).toBe('function');
    expect(module.SpeedDialAction).toBe(module.default);
  });
});
