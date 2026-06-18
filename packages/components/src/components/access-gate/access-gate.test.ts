/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: AccessGate } = await import('./access-gate.svelte');
const { createRawSnippet, tick } = await import('svelte');

function markupSnippet(markup: string) {
  return createRawSnippet(() => ({
    render: () => markup,
  }));
}

describe('AccessGate', () => {
  afterEach(() => {
    cleanup();
  });

  test('granted inline gates render children without an extra wrapper', () => {
    const { container } = render(AccessGate, {
      granted: true,
      reason: 'Requires scope: workflows:cancel',
      children: markupSnippet('<button type="button">Cancel</button>'),
    });

    const button = container.querySelector<HTMLButtonElement>('button');
    expect(container.querySelector('.cinder-access-gate')).toBeNull();
    expect(container.children).toHaveLength(1);
    expect(container.firstElementChild).toBe(button);
    expect(button?.disabled).toBe(false);
  });

  test('denied inline gates disable native controls and associate the reason', async () => {
    const { container, getByRole } = render(AccessGate, {
      granted: false,
      reason: 'Requires scope: workflows:cancel',
      children: markupSnippet('<button type="button">Cancel workflow</button>'),
    });

    await tick();

    const button = getByRole('button', { name: 'Cancel workflow' }) as HTMLButtonElement;
    const reason = container.querySelector('.cinder-access-gate__inline-reason');

    expect(button.disabled).toBe(true);
    expect(reason).not.toBeNull();
    expect(reason?.textContent).toContain('Requires scope: workflows:cancel');
    expect(button.getAttribute('aria-describedby')?.split(/\s+/)).toContain(reason!.id);
  });

  test('denied inline gates preserve existing descriptions while adding the reason', async () => {
    const { container, getByRole } = render(AccessGate, {
      granted: false,
      reason: 'Requires scope: runs:purge',
      children: markupSnippet(
        '<button type="button" aria-describedby="existing-hint">Purge run</button>',
      ),
    });

    await tick();

    const button = getByRole('button', { name: 'Purge run' }) as HTMLButtonElement;
    const reason = container.querySelector('.cinder-access-gate__inline-reason');
    const describedBy = button.getAttribute('aria-describedby')?.split(/\s+/) ?? [];

    expect(reason).not.toBeNull();
    expect(describedBy).toContain('existing-hint');
    expect(describedBy).toContain(reason!.id);
  });

  test('denied inline gates remove custom controls from sequential focus and activation', async () => {
    const { container } = render(AccessGate, {
      granted: false,
      reason: 'Requires scope: workflows:suspend',
      children: markupSnippet(
        '<span><a href="/runs/123/suspend">Suspend</a><span role="button" tabindex="0">Suspend custom</span></span>',
      ),
    });

    await tick();

    const link = container.querySelector<HTMLAnchorElement>('a');
    const customControl = container.querySelector<HTMLElement>('[role="button"]');

    expect(link?.getAttribute('aria-disabled')).toBe('true');
    expect(link?.getAttribute('tabindex')).toBe('-1');
    expect(link?.hasAttribute('href')).toBe(false);
    expect(customControl?.getAttribute('aria-disabled')).toBe('true');
    expect(customControl?.getAttribute('tabindex')).toBe('-1');
  });

  test('denied section gates replace children with a locked placeholder', () => {
    const { container, queryByText, getByText } = render(AccessGate, {
      granted: false,
      variant: 'section',
      reason: 'Requires scope: storage:admin',
      requirement: 'storage:admin',
      children: markupSnippet('<button type="button">Delete bucket</button>'),
    });

    const section = container.querySelector('.cinder-access-gate');
    const requirement = container.querySelector('.cinder-access-gate__requirement');

    expect(queryByText('Delete bucket')).toBeNull();
    expect(getByText('Section locked')).not.toBeNull();
    expect(getByText('Requires scope: storage:admin')).not.toBeNull();
    expect(getByText('storage:admin')).not.toBeNull();
    expect(requirement).not.toBeNull();
    expect(section).not.toBeNull();
    expect(section?.getAttribute('data-cinder-variant')).toBe('section');
    expect(section?.tagName).toBe('SECTION');
    expect(section!.getAttribute('aria-describedby')?.split(/\s+/)).toContain(requirement!.id);
  });

  test('denied-state wrappers merge custom classes', () => {
    const { container } = render(AccessGate, {
      granted: false,
      reason: 'Requires scope: workflows:cancel',
      class: 'custom-access-state',
      children: markupSnippet('<button type="button">Cancel</button>'),
    });

    const gate = container.querySelector('.cinder-access-gate');
    expect(gate?.classList.contains('custom-access-state')).toBe(true);
  });
});
