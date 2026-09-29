/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { render, cleanup } = await import('@testing-library/svelte');

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const { default: Wrapper } = await import('../../test/fixtures/choice-grid-fixture.svelte');

// ---------------------------------------------------------------------------
// ARIA structure
// ---------------------------------------------------------------------------

describe('ChoiceGrid accessible name', () => {
  test('an empty ariaLabel does not emit aria-label="" (which would suppress naming)', () => {
    const { container } = render(Wrapper, {
      ariaLabel: '',
      items: [{ value: 'a', label: 'A' }],
    });
    const group = container.querySelector('[role="radiogroup"]');
    // Empty string is normalized to undefined → the attribute is absent.
    expect(group?.hasAttribute('aria-label')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Feedback states
// ---------------------------------------------------------------------------
