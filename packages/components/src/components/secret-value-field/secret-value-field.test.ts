/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent, waitFor, cleanup } = await import('@testing-library/svelte');
const { default: SecretValueField } = await import('./secret-value-field.svelte');
const { createRawSnippet } = await import('svelte');

function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
  }));
}

type ClipboardLike = { writeText: (text: string) => Promise<void> };

let originalClipboard: ClipboardLike | undefined;

function mockClipboard(writes: string[] = []): ClipboardLike {
  const clipboard: ClipboardLike = {
    writeText: async (text: string) => {
      writes.push(text);
    },
  };
  Object.defineProperty(globalThis.navigator, 'clipboard', {
    configurable: true,
    value: clipboard,
  });
  return clipboard;
}

beforeEach(() => {
  document.body.replaceChildren();
  originalClipboard = globalThis.navigator.clipboard as unknown as ClipboardLike | undefined;
});

afterEach(() => {
  cleanup();
  if (originalClipboard) {
    Object.defineProperty(globalThis.navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    });
  } else {
    delete (globalThis.navigator as unknown as { clipboard?: ClipboardLike }).clipboard;
  }
});

describe('SecretValueField', () => {
  describe('structure', () => {
    test('renders root element with cinder-secret-value-field class', () => {
      const { container } = render(SecretValueField, { value: 'example_live_abc123' });
      const root = container.querySelector('.cinder-secret-value-field');
      expect(root).not.toBeNull();
    });

    test('renders a label with default text "Secret value"', () => {
      const { container } = render(SecretValueField, { value: 'example_live_abc123' });
      const label = container.querySelector('.cinder-secret-value-field__label');
      expect(label).not.toBeNull();
      expect(label?.textContent?.trim()).toBe('Secret value');
    });

    test('renders a custom label when provided', () => {
      const { container } = render(SecretValueField, {
        value: 'example_live_abc123',
        label: 'API Key',
      });
      const label = container.querySelector('.cinder-secret-value-field__label');
      expect(label?.textContent?.trim()).toBe('API Key');
    });

    test('renders the masked value display by default', () => {
      const { container } = render(SecretValueField, { value: 'example_live_abc123' });
      const valueEl = container.querySelector('.cinder-secret-value-field__value');
      expect(valueEl).not.toBeNull();
      expect(valueEl?.hasAttribute('data-cinder-masked')).toBe(true);
      // The actual secret must NOT appear in the DOM
      expect(container.textContent).not.toContain('example_live_abc123');
    });

    test('renders prefix when provided', () => {
      const { container } = render(SecretValueField, {
        value: 'abc123',
        prefix: 'example_live_',
      });
      const prefix = container.querySelector('.cinder-secret-value-field__prefix');
      expect(prefix).not.toBeNull();
      expect(prefix?.textContent).toBe('example_live_');
    });

    test('renders suffix when provided', () => {
      const { container } = render(SecretValueField, {
        value: 'abc123',
        suffix: 'a3f9',
      });
      const suffix = container.querySelector('.cinder-secret-value-field__suffix');
      expect(suffix).not.toBeNull();
      expect(suffix?.textContent).toBe('a3f9');
    });

    test('does not render prefix element when prefix is not provided', () => {
      const { container } = render(SecretValueField, { value: 'abc123' });
      expect(container.querySelector('.cinder-secret-value-field__prefix')).toBeNull();
    });

    test('renders a copy button', () => {
      const { container } = render(SecretValueField, { value: 'abc123' });
      const copyBtn = container.querySelector('.cinder-secret-value-field__copy');
      expect(copyBtn).not.toBeNull();
      expect(copyBtn?.getAttribute('type')).toBe('button');
    });

    test('does not render reveal toggle by default (allowReveal is false)', () => {
      const { container } = render(SecretValueField, { value: 'abc123' });
      expect(container.querySelector('.cinder-secret-value-field__toggle')).toBeNull();
    });

    test('renders reveal toggle when allowReveal is true', () => {
      const { container } = render(SecretValueField, { value: 'abc123', allowReveal: true });
      const toggle = container.querySelector('.cinder-secret-value-field__toggle');
      expect(toggle).not.toBeNull();
    });
  });

  describe('security', () => {
    test('secret value is never placed in any attribute', () => {
      const secret = 'super_secret_token_xyz789';
      const { container } = render(SecretValueField, { value: secret });
      // The secret should not appear anywhere in the HTML (title, aria-label, data-*, etc.)
      expect(container.innerHTML).not.toContain(secret);
    });

    test('secret is not visible in masked DOM text content', () => {
      const secret = 'example_live_verysecret';
      const { container } = render(SecretValueField, { value: secret });
      expect(container.textContent).not.toContain(secret);
    });

    test('after copy, no visible text contains the secret', async () => {
      const secret = 'token_should_not_appear';
      mockClipboard();
      const { container } = render(SecretValueField, { value: secret });
      const copyBtn = container.querySelector(
        '.cinder-secret-value-field__copy',
      ) as HTMLButtonElement;
      await fireEvent.click(copyBtn);
      await waitFor(() => {
        expect(copyBtn.hasAttribute('data-cinder-copied')).toBe(true);
      });
      // Secret must NOT be in any visible text or attribute after copy
      expect(container.innerHTML).not.toContain(secret);
    });

    test('copy button aria-label names the field but never contains the secret', () => {
      const secret = 'example_test_abc123xyz';
      const { container } = render(SecretValueField, {
        value: secret,
        label: 'API Key',
      });
      const copyBtn = container.querySelector('.cinder-secret-value-field__copy');
      const ariaLabel = copyBtn?.getAttribute('aria-label') ?? '';
      expect(ariaLabel).not.toContain(secret);
      // It should name the action and the field label; never the value
      expect(ariaLabel).toBe('Copy API Key');
    });

    test('value display aria-label does not contain the secret', () => {
      const secret = 'super_private_value';
      const { container } = render(SecretValueField, {
        value: secret,
        label: 'Webhook Secret',
      });
      const valueEl = container.querySelector('.cinder-secret-value-field__value');
      const ariaLabel = valueEl?.getAttribute('aria-label') ?? '';
      expect(ariaLabel).not.toContain(secret);
    });

    test('when revealed, secret is in visible text but never in any attribute', async () => {
      const secret = 'example_live_revealme123';
      const { container } = render(SecretValueField, {
        value: secret,
        label: 'API Key',
        allowReveal: true,
      });
      const toggle = container.querySelector(
        '.cinder-secret-value-field__toggle',
      ) as HTMLButtonElement;
      await fireEvent.click(toggle);
      await waitFor(() => {
        // Secret is now in visible text (the whole point of reveal)
        const valueEl = container.querySelector('.cinder-secret-value-field__value');
        expect(valueEl?.textContent).toContain(secret);
        // But it must NOT be in any attribute — aria-label, data-*, title, etc.
        const html = container.innerHTML;
        // Check that the value only appears as text content, not in an attribute
        // An attribute would look like: ="...secret..." or ='...secret...'
        expect(html).not.toMatch(new RegExp(`=["'][^"']*${secret}[^"']*["']`));
      });
    });
  });

  describe('behavior', () => {
    test('clicking copy writes value to clipboard and shows confirmation', async () => {
      const writes: string[] = [];
      mockClipboard(writes);
      const { container } = render(SecretValueField, { value: 'abc123' });
      const copyBtn = container.querySelector(
        '.cinder-secret-value-field__copy',
      ) as HTMLButtonElement;
      await fireEvent.click(copyBtn);
      await waitFor(() => {
        expect(writes).toEqual(['abc123']);
        expect(copyBtn.hasAttribute('data-cinder-copied')).toBe(true);
      });
    });

    test('copy confirmation is announced via live region, not button text', async () => {
      mockClipboard();
      const { container } = render(SecretValueField, { value: 'abc123' });
      const copyBtn = container.querySelector(
        '.cinder-secret-value-field__copy',
      ) as HTMLButtonElement;
      await fireEvent.click(copyBtn);
      await waitFor(() => {
        const liveRegion = container.querySelector('[role="status"][aria-live="polite"]');
        expect(liveRegion).not.toBeNull();
        expect(liveRegion?.textContent?.trim()).toBe('Copied');
      });
    });

    test('custom copiedLabel is announced in the live region', async () => {
      mockClipboard();
      const { container } = render(SecretValueField, {
        value: 'abc123',
        copiedLabel: 'API key copied',
      });
      const copyBtn = container.querySelector(
        '.cinder-secret-value-field__copy',
      ) as HTMLButtonElement;
      await fireEvent.click(copyBtn);
      await waitFor(() => {
        const liveRegion = container.querySelector('[role="status"][aria-live="polite"]');
        expect(liveRegion?.textContent?.trim()).toBe('API key copied');
      });
    });

    test('reveal toggle shows the secret value when clicked', async () => {
      const { container } = render(SecretValueField, {
        value: 'example_live_abc123',
        allowReveal: true,
      });
      const toggle = container.querySelector(
        '.cinder-secret-value-field__toggle',
      ) as HTMLButtonElement;
      expect(toggle.getAttribute('aria-pressed')).toBe('false');

      await fireEvent.click(toggle);

      await waitFor(() => {
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
        const valueEl = container.querySelector('.cinder-secret-value-field__value');
        expect(valueEl?.textContent).toContain('example_live_abc123');
        expect(valueEl?.hasAttribute('data-cinder-masked')).toBe(false);
      });
    });

    test('reveal toggle hides the secret again when clicked a second time', async () => {
      const { container } = render(SecretValueField, {
        value: 'example_live_abc123',
        allowReveal: true,
      });
      const toggle = container.querySelector(
        '.cinder-secret-value-field__toggle',
      ) as HTMLButtonElement;

      await fireEvent.click(toggle);
      await waitFor(() => {
        expect(toggle.getAttribute('aria-pressed')).toBe('true');
      });

      await fireEvent.click(toggle);
      await waitFor(() => {
        expect(toggle.getAttribute('aria-pressed')).toBe('false');
        const valueEl = container.querySelector('.cinder-secret-value-field__value');
        expect(valueEl?.hasAttribute('data-cinder-masked')).toBe(true);
        expect(container.textContent).not.toContain('example_live_abc123');
      });
    });

    test('initiallyRevealed shows the value on first render', () => {
      const { container } = render(SecretValueField, {
        value: 'example_live_abc123',
        initiallyRevealed: true,
      });
      const valueEl = container.querySelector('.cinder-secret-value-field__value');
      expect(valueEl?.textContent).toContain('example_live_abc123');
      expect(valueEl?.hasAttribute('data-cinder-masked')).toBe(false);
    });

    test('changing the secret value resets a user reveal', async () => {
      const { container, rerender } = render(SecretValueField, {
        value: 'first-secret',
        allowReveal: true,
      });
      const toggle = container.querySelector(
        '.cinder-secret-value-field__toggle',
      ) as HTMLButtonElement;

      await fireEvent.click(toggle);
      expect(container.textContent).toContain('first-secret');

      await rerender({ value: 'second-secret', allowReveal: true });
      await waitFor(() => {
        const valueEl = container.querySelector('.cinder-secret-value-field__value');
        expect(valueEl?.hasAttribute('data-cinder-masked')).toBe(true);
        expect(container.textContent).not.toContain('second-secret');
      });
    });

    test('changing the secret value honors an explicit initiallyRevealed value', async () => {
      const { container, rerender } = render(SecretValueField, {
        value: 'first-secret',
        allowReveal: true,
        initiallyRevealed: true,
      });

      await rerender({
        value: 'second-secret',
        allowReveal: true,
        initiallyRevealed: true,
      });
      await waitFor(() => {
        const valueEl = container.querySelector('.cinder-secret-value-field__value');
        expect(valueEl?.hasAttribute('data-cinder-masked')).toBe(false);
        expect(container.textContent).toContain('second-secret');
      });
    });

    test('reveal toggle does not render when allowReveal is false', () => {
      const { container } = render(SecretValueField, { value: 'abc123' });
      const toggle = container.querySelector('.cinder-secret-value-field__toggle');
      expect(toggle).toBeNull();
    });

    test('native attributes pass through to the root element', () => {
      const { container } = render(SecretValueField, {
        value: 'abc',
        id: 'my-field',
        'data-testid': 'secret-field',
      });
      const root = container.querySelector('.cinder-secret-value-field');
      expect(root?.getAttribute('id')).toBe('my-field');
      expect(root?.getAttribute('data-testid')).toBe('secret-field');
    });

    test('merges custom class alongside cinder-secret-value-field', () => {
      const { container } = render(SecretValueField, {
        value: 'abc',
        class: 'my-custom-class',
      });
      const root = container.querySelector('.cinder-secret-value-field');
      expect(root?.getAttribute('class')).toContain('cinder-secret-value-field');
      expect(root?.getAttribute('class')).toContain('my-custom-class');
    });

    test('renders warning slot content when provided', () => {
      const { container } = render(SecretValueField, {
        value: 'abc123',
        warning: textSnippet('Copy this now; it will not be shown again.'),
      });
      const warningEl = container.querySelector('.cinder-secret-value-field__warning');
      expect(warningEl).not.toBeNull();
      expect(warningEl?.textContent).toContain('Copy this now; it will not be shown again.');
    });

    test('does not render warning container when warning slot is not provided', () => {
      const { container } = render(SecretValueField, { value: 'abc123' });
      expect(container.querySelector('.cinder-secret-value-field__warning')).toBeNull();
    });
  });

  describe('accessibility', () => {
    test('copy button has accessible aria-label referencing the field label', () => {
      const { container } = render(SecretValueField, {
        value: 'abc123',
        label: 'API Key',
      });
      const copyBtn = container.querySelector('.cinder-secret-value-field__copy');
      expect(copyBtn?.getAttribute('aria-label')).toBe('Copy API Key');
    });

    test('copy button aria-label stays stable after copy; success is announced via live region only', async () => {
      // A11y contract: the copy button keeps a STABLE accessible name ("Copy API Key") throughout.
      // The success announcement ("Copied") is handled exclusively by the live region.
      // Changing the button's accessible name on copy double-announces (the AT reads the name change
      // as a live-region update AND as the button name on next focus) — this mirrors CopyButton's model.
      mockClipboard();
      const { container } = render(SecretValueField, {
        value: 'abc123',
        label: 'API Key',
        copiedLabel: 'Copied',
      });
      const copyBtn = container.querySelector(
        '.cinder-secret-value-field__copy',
      ) as HTMLButtonElement;
      expect(copyBtn.getAttribute('aria-label')).toBe('Copy API Key');
      await fireEvent.click(copyBtn);
      await waitFor(() => {
        // aria-label is unchanged — the live region owns the announcement.
        expect(copyBtn.getAttribute('aria-label')).toBe('Copy API Key');
        expect(copyBtn.hasAttribute('data-cinder-copied')).toBe(true);
        const liveRegion = container.querySelector('[role="status"][aria-live="polite"]');
        expect(liveRegion?.textContent?.trim()).toBe('Copied');
      });
    });

    test('value region has descriptive aria-label for screen readers (masked state)', () => {
      const { container } = render(SecretValueField, {
        value: 'abc123',
        label: 'Webhook Secret',
      });
      const valueEl = container.querySelector('.cinder-secret-value-field__value');
      expect(valueEl?.getAttribute('aria-label')).toBe('Webhook Secret, masked');
    });

    test('value region aria-label updates to "revealed" when shown', async () => {
      const { container } = render(SecretValueField, {
        value: 'abc123',
        label: 'Webhook Secret',
        allowReveal: true,
      });
      const toggle = container.querySelector(
        '.cinder-secret-value-field__toggle',
      ) as HTMLButtonElement;
      await fireEvent.click(toggle);
      await waitFor(() => {
        const valueEl = container.querySelector('.cinder-secret-value-field__value');
        expect(valueEl?.getAttribute('aria-label')).toBe('Webhook Secret, revealed');
      });
    });

    test('value region and buttons are grouped with aria-labelledby referencing the label', () => {
      const { container } = render(SecretValueField, { value: 'abc123', label: 'API Key' });
      const label = container.querySelector('.cinder-secret-value-field__label');
      const group = container.querySelector('[role="group"]');
      expect(group).not.toBeNull();
      // The label must have an id
      expect(label?.id).toBeTruthy();
      // The group must be labelled by the label's id
      expect(group?.getAttribute('aria-labelledby')).toBe(label?.id);
    });

    test('reveal toggle has aria-pressed attribute starting at false', () => {
      const { container } = render(SecretValueField, {
        value: 'abc123',
        allowReveal: true,
      });
      const toggle = container.querySelector('.cinder-secret-value-field__toggle');
      expect(toggle?.hasAttribute('aria-pressed')).toBe(true);
      expect(toggle?.getAttribute('aria-pressed')).toBe('false');
    });

    test('reveal toggle aria-label changes between reveal and hide states', async () => {
      const { container } = render(SecretValueField, {
        value: 'abc123',
        label: 'API Key',
        allowReveal: true,
      });
      const toggle = container.querySelector(
        '.cinder-secret-value-field__toggle',
      ) as HTMLButtonElement;
      expect(toggle.getAttribute('aria-label')).toBe('Reveal API Key');

      await fireEvent.click(toggle);
      await waitFor(() => {
        expect(toggle.getAttribute('aria-label')).toBe('Hide API Key');
      });
    });

    test('keyboard: reveal toggle is focusable as a button element', () => {
      const { container } = render(SecretValueField, {
        value: 'abc123',
        allowReveal: true,
      });
      const toggle = container.querySelector(
        '.cinder-secret-value-field__toggle',
      ) as HTMLButtonElement;
      toggle.focus();
      expect(document.activeElement).toBe(toggle);
    });

    test('keyboard: copy button is focusable as a button element', () => {
      const { container } = render(SecretValueField, { value: 'token123' });
      const copyBtn = container.querySelector(
        '.cinder-secret-value-field__copy',
      ) as HTMLButtonElement;
      copyBtn.focus();
      expect(document.activeElement).toBe(copyBtn);
    });

    test('live region is always present in DOM (not conditionally rendered)', () => {
      const { container } = render(SecretValueField, { value: 'abc123' });
      const liveRegion = container.querySelector('[role="status"][aria-live="polite"]');
      expect(liveRegion).not.toBeNull();
    });

    test('live region has aria-atomic="true"', () => {
      const { container } = render(SecretValueField, { value: 'abc123' });
      const liveRegion = container.querySelector('[role="status"]');
      expect(liveRegion?.getAttribute('aria-atomic')).toBe('true');
    });

    test('prefix and suffix have aria-hidden to avoid double-reading', () => {
      const { container } = render(SecretValueField, {
        value: 'abc123',
        prefix: 'example_live_',
        suffix: 'a3f9',
      });
      const prefix = container.querySelector('.cinder-secret-value-field__prefix');
      const suffix = container.querySelector('.cinder-secret-value-field__suffix');
      expect(prefix?.getAttribute('aria-hidden')).toBe('true');
      expect(suffix?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('CSS snapshot', () => {
    test('CSS file exists and contains cinder-secret-value-field', async () => {
      const { readFileSync } = await import('node:fs');
      const css = readFileSync(new URL('./secret-value-field.css', import.meta.url), 'utf8');
      expect(css).toContain('cinder-secret-value-field');
      expect(css).toContain('@layer cinder.components');
    });
  });
});
