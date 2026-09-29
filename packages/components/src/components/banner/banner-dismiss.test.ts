import { requiredInstance } from '@lostgradient/testing';
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, test } from 'bun:test';
import { createRawSnippet } from 'svelte';
import Banner from './banner.svelte';
const emptySnippet = createRawSnippet(() => ({ render: () => '<span></span>' }));
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

describe('Banner dismiss behavior', () => {
  test('renders a dismiss button when dismissible defaults to true', () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    expect(container.querySelector('.cinder-banner__dismiss')).not.toBeNull();
  });

  test('does not render dismiss button when dismissible={false}', () => {
    const { container } = render(Banner, {
      props: { dismissible: false, children: emptySnippet },
    });
    expect(container.querySelector('.cinder-banner__dismiss')).toBeNull();
  });

  test('dismiss button is a <button type="button"> with aria-label="Dismiss banner"', () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    const button = container.querySelector('.cinder-banner__dismiss');
    expect(button).not.toBeNull();
    expect(button?.tagName).toBe('BUTTON');
    expect(button?.getAttribute('type')).toBe('button');
    expect(button?.getAttribute('aria-label')).toBe('Dismiss banner');
  });

  test('clicking the dismiss button removes the banner from the DOM', async () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    const button = requiredInstance(
      container.querySelector('.cinder-banner__dismiss'),
      HTMLButtonElement,
    );
    await fireEvent.click(button);
    expect(container.querySelector('.cinder-banner')).toBeNull();
  });

  test('clicking the dismiss button invokes onDismiss exactly once', async () => {
    let callCount = 0;
    const { container } = render(Banner, {
      props: {
        onDismiss: () => {
          callCount += 1;
        },
        children: emptySnippet,
      },
    });
    const button = requiredInstance(
      container.querySelector('.cinder-banner__dismiss'),
      HTMLButtonElement,
    );
    await fireEvent.click(button);
    expect(callCount).toBe(1);
  });

  test('dismissing while focused moves focus to the next focusable element', async () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    const after = document.createElement('button');
    after.type = 'button';
    after.textContent = 'Continue';
    container.after(after);

    try {
      const button = requiredInstance(
        container.querySelector('.cinder-banner__dismiss'),
        HTMLButtonElement,
      );
      button.focus();
      expect(document.activeElement).toBe(button);
      await fireEvent.click(button);
      expect(container.querySelector('.cinder-banner')).toBeNull();
      expect(document.activeElement).toBe(after);
    } finally {
      after.remove();
    }
  });

  test('omitting onDismiss does not throw when the dismiss button is clicked', async () => {
    const { container } = render(Banner, {
      props: { children: emptySnippet },
    });
    const button = requiredInstance(
      container.querySelector('.cinder-banner__dismiss'),
      HTMLButtonElement,
    );
    await fireEvent.click(button);
    expect(container.querySelector('.cinder-banner')).toBeNull();
  });

  test('dismissing while focused falls back to the nearest preceding focusable element', async () => {
    // Mark every existing focusable as inert-scoped so leakage from prior
    // tests cannot become the "next" candidate. The component's filter skips
    // anything inside a `[inert]` ancestor.
    const inertWrapper = document.createElement('div');
    inertWrapper.setAttribute('inert', '');
    while (document.body.firstChild) {
      inertWrapper.appendChild(document.body.firstChild);
    }
    document.body.appendChild(inertWrapper);

    const before = document.createElement('button');
    before.type = 'button';
    before.textContent = 'Back';
    document.body.appendChild(before);

    const { container, unmount } = render(Banner, {
      props: { children: emptySnippet },
    });

    try {
      const button = requiredInstance(
        container.querySelector('.cinder-banner__dismiss'),
        HTMLButtonElement,
      );
      button.focus();
      expect(document.activeElement).toBe(button);
      await fireEvent.click(button);
      expect(container.querySelector('.cinder-banner')).toBeNull();
      expect(document.activeElement).toBe(before);
    } finally {
      unmount();
      before.remove();
      // Restore the original body children for subsequent tests.
      while (inertWrapper.firstChild) {
        document.body.appendChild(inertWrapper.firstChild);
      }
      inertWrapper.remove();
    }
  });

  test('rapid double-click on dismiss invokes onDismiss exactly once', async () => {
    let callCount = 0;
    const { container } = render(Banner, {
      props: {
        onDismiss: () => {
          callCount += 1;
        },
        children: emptySnippet,
      },
    });
    const button = requiredInstance(
      container.querySelector('.cinder-banner__dismiss'),
      HTMLButtonElement,
    );
    await fireEvent.click(button);
    await fireEvent.click(button);
    expect(callCount).toBe(1);
  });

  test('banner is removed from the DOM before onDismiss fires', async () => {
    let bannerStillPresent = true;
    const { container } = render(Banner, {
      props: {
        onDismiss: () => {
          bannerStillPresent = container.querySelector('.cinder-banner') !== null;
        },
        children: emptySnippet,
      },
    });
    const button = requiredInstance(
      container.querySelector('.cinder-banner__dismiss'),
      HTMLButtonElement,
    );
    await fireEvent.click(button);
    expect(bannerStillPresent).toBe(false);
  });
});
