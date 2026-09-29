/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import { afterEach, describe, expect, jest, test } from 'bun:test';
import { markupSnippet } from './share-card-test-support.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { createRawSnippet } = await import('svelte');
const { default: ShareCard } = await import('./share-card.svelte');
afterEach(() => {
  cleanup();
  if (jest.isFakeTimers()) jest.useRealTimers();
});

describe('ShareCard Input composition', () => {
  test('the icon-only actions render inside a <span>, not a <div>, so the trailing addon nesting stays valid', () => {
    // `Input`'s `trailing` addon wraps whatever it's given in
    // `<span class="cinder-input-group__trailing">`. A `<span>` is phrasing
    // content and cannot legally contain a `<div>` (flow content) — browsers
    // parse a `<div>` there back out to a sibling, breaking the layout. Guard
    // the element type directly.
    const { container } = render(ShareCard, { value: 'https://example.com' });
    const trailing = container.querySelector('.cinder-input-group__trailing');
    expect(trailing).not.toBeNull();
    const actions = trailing?.querySelector('.cinder-share-card__actions');
    expect(actions?.tagName).toBe('SPAN');
    expect(trailing?.querySelector('div')).toBeNull();
  });

  test('the value field presents identically in both action layouts', () => {
    // `labelSnippet` presence decides whether the actions ride inside `Input`'s trailing
    // addon or render as a sibling row. That used to be two separate `Input` arms,
    // which tore the value field down on a presentation-only change; it is one call
    // site now (CIN-512), and the test below pins the element's identity across the
    // boundary. This one keeps guarding that the field presents the same contract in
    // both layouts, asserted on the rendered result rather than by regex-parsing the
    // source, so a reformat or refactor cannot fail it without a behavioural change.
    const richLabel = createRawSnippet(() => ({ render: () => '<span>Copy it</span>' }));
    const value = 'https://example.com/a/b/c';

    const compact = render(ShareCard, {
      value,
      actions: [{ key: 'copy', label: 'Copy', copyValue: value }],
    });
    const compactField = compact.container.querySelector<HTMLInputElement>(
      '.cinder-share-card__value',
    )!;
    const compactContract = {
      tagName: compactField.tagName,
      value: compactField.value,
      readOnly: compactField.readOnly,
      title: compactField.getAttribute('title'),
      ariaLabel: compactField.getAttribute('aria-label'),
      className: compactField.className,
    };
    compact.unmount();

    const rich = render(ShareCard, {
      value,
      actions: [{ key: 'copy', label: 'Copy', labelSnippet: richLabel, copyValue: value }],
    });
    const richField = rich.container.querySelector<HTMLInputElement>('.cinder-share-card__value')!;
    const richContract = {
      tagName: richField.tagName,
      value: richField.value,
      readOnly: richField.readOnly,
      title: richField.getAttribute('title'),
      ariaLabel: richField.getAttribute('aria-label'),
      className: richField.className,
    };
    rich.unmount();

    expect(richContract).toEqual(compactContract);
    // Sanity-check the contract is not vacuously empty on both sides.
    expect(compactContract.value).toBe(value);
    expect(compactContract.readOnly).toBe(true);
  });

  test('the value field keeps its native element when actions cross the labelSnippet boundary', async () => {
    // A parent that reactively changes `actions` so that a `labelSnippet` appears or
    // disappears moves the actions between the trailing addon and the sibling row.
    // With one `Input` call site and Input keeping its element across an addon
    // toggle (CIN-500), that is a prop update on the same element: focus and the
    // selection range survive. Exactly one field is asserted alongside identity
    // because happy-dom can leave a torn-down `{#if}` arm's nodes connected, and
    // identity alone would then pass against the stale node.
    const richLabel = createRawSnippet(() => ({ render: () => '<span>Copy it</span>' }));
    const value = 'https://example.com/a/b/c';
    const compactActions = [{ key: 'copy', label: 'Copy', copyValue: value }];
    const richActions = [{ key: 'copy', label: 'Copy', labelSnippet: richLabel, copyValue: value }];

    const { container, rerender } = render(ShareCard, { value, actions: compactActions });
    const field = () => container.querySelectorAll<HTMLInputElement>('.cinder-share-card__value');
    expect(field()).toHaveLength(1);
    const before = field()[0]!;
    before.focus();
    before.setSelectionRange(8, 19);
    expect(document.activeElement).toBe(before);
    expect(
      container.querySelector('.cinder-input-group__trailing .cinder-share-card__actions'),
    ).not.toBeNull();

    await rerender({ actions: richActions });
    expect(field()).toHaveLength(1);
    expect(field()[0]).toBe(before);
    expect(document.activeElement).toBe(before);
    expect(before.selectionStart).toBe(8);
    expect(before.selectionEnd).toBe(19);
    expect(container.querySelector('.cinder-input-group')).toBeNull();
    expect(container.querySelector('.cinder-share-card__actions')?.parentElement).toBe(
      container.querySelector<HTMLElement>('.cinder-share-card'),
    );

    await rerender({ actions: compactActions });
    expect(field()).toHaveLength(1);
    expect(field()[0]).toBe(before);
    expect(document.activeElement).toBe(before);
    expect(before.selectionStart).toBe(8);
    expect(before.selectionEnd).toBe(19);
    expect(
      container.querySelector('.cinder-input-group__trailing .cinder-share-card__actions'),
    ).not.toBeNull();
  });

  test('both action layouts render exactly one value field, in the right place', () => {
    const richLabel = createRawSnippet(() => ({ render: () => '<span>Copy it</span>' }));

    const compact = render(ShareCard, {
      value: 'https://example.com/a',
      actions: [{ key: 'copy', label: 'Copy', copyValue: 'https://example.com/a' }],
    });
    expect(compact.container.querySelectorAll('.cinder-share-card__value')).toHaveLength(1);
    // Compact layout: the actions ride inside the field's trailing addon.
    expect(
      compact.container.querySelector('.cinder-input-group__trailing .cinder-share-card__actions'),
    ).not.toBeNull();
    compact.unmount();

    const rich = render(ShareCard, {
      value: 'https://example.com/a',
      actions: [
        { key: 'copy', label: 'Copy', labelSnippet: richLabel, copyValue: 'https://example.com/a' },
      ],
    });
    expect(rich.container.querySelectorAll('.cinder-share-card__value')).toHaveLength(1);
    // Rich layout: the actions render outside the field, where the narrow trailing slot
    // would otherwise clip them.
    expect(
      rich.container.querySelector('.cinder-input-group__trailing .cinder-share-card__actions'),
    ).toBeNull();
    expect(rich.container.querySelector('.cinder-share-card__actions')).not.toBeNull();
    rich.unmount();
  });

  test('actions with a labelSnippet render OUTSIDE the value field, not inside its constrained trailing slot', () => {
    const { container } = render(ShareCard, {
      value: 'https://example.com',
      actions: [
        {
          key: 'copy-link',
          label: 'Copy link',
          copyValue: 'https://example.com',
          labelSnippet: markupSnippet('<strong>Custom copy label</strong>'),
        },
      ],
    });
    const actions = container.querySelector('.cinder-share-card__actions');
    expect(actions).not.toBeNull();
    // No `.cinder-input-group` addon wrapper at all in this path — the field
    // renders with no `trailing`, so `Input` renders a bare `<input>` with no
    // group wrapper, and the actions render as a direct sibling of the field
    // (inside `.cinder-share-card` itself) instead of being squeezed into a
    // slot that caps at `max-inline-size: 40%`.
    expect(container.querySelector('.cinder-input-group')).toBeNull();
    expect(actions?.parentElement).toBe(container.querySelector<HTMLElement>('.cinder-share-card'));
  });

  test('icon-only actions (no labelSnippet) still render inside the value field trailing addon', () => {
    const { container } = render(ShareCard, { value: 'https://example.com' });
    const inputGroup = container.querySelector('.cinder-input-group');
    const actions = container.querySelector('.cinder-share-card__actions');
    expect(actions).not.toBeNull();
    expect(inputGroup?.contains(actions)).toBe(true);
  });
});
