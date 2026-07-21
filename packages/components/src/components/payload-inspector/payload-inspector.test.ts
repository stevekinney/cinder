/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import Ajv2020 from 'ajv/dist/2020';
import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, cleanup, fireEvent } = await import('@testing-library/svelte');
const { default: PayloadInspector } = await import('./payload-inspector.svelte');
const { default: payloadInspectorSchema } = await import('./payload-inspector.schema.ts');

beforeEach(() => document.body.replaceChildren());
afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderInspector(props: Record<string, unknown> = {}) {
  return render(PayloadInspector, props);
}

describe('PayloadInspector', () => {
  describe('schema', () => {
    test('models JSON payload values as supported input', () => {
      const ajv = new Ajv2020({ strict: false });
      const validate = ajv.compile(payloadInspectorSchema);

      expect(payloadInspectorSchema.properties).toHaveProperty('value');
      expect(payloadInspectorSchema.metadata?.unsupportedProps?.map((prop) => prop.name)).toEqual([
        'parse',
      ]);

      expect(
        validate({
          value: {
            filters: {
              include: {
                branch: 'main',
              },
            },
            matrix: [['bun', 'test']],
          },
        }),
      ).toBe(true);
      expect(validate.errors).toBeNull();
    });

    test('accepts deeply nested payload arrays without a depth boundary', () => {
      const ajv = new Ajv2020({ strict: false });
      const validate = ajv.compile(payloadInspectorSchema);

      expect(
        validate({
          value: [[[[[['leaf']]]]]],
        }),
      ).toBe(true);
      expect(validate.errors).toBeNull();
    });
  });

  describe('structure', () => {
    test('renders a non-landmark root with the component class', () => {
      const { container } = renderInspector({ value: { key: 'value' } });
      const root = container.querySelector('.cinder-payload-inspector');
      expect(root).not.toBeNull();
      expect(root?.tagName.toLowerCase()).toBe('div');
      expect(root?.getAttribute('role')).toBeNull();
    });

    test('renders the header with label text', () => {
      const { getByText } = renderInspector({ value: null, label: 'Custom label' });
      expect(getByText('Custom label')).not.toBeNull();
    });

    test('default label is "Payload inspector"', () => {
      const { container } = renderInspector({ value: null });
      const header = container.querySelector('.cinder-payload-inspector__header');
      expect(header?.textContent).toContain('Payload inspector');
    });

    test('renders no tabs', () => {
      const { container } = renderInspector({ value: { hello: 'world' } });
      expect(container.querySelector('[role="tablist"]')).toBeNull();
      expect(container.querySelectorAll('[role="tab"]')).toHaveLength(0);
    });

    test('renders byte size in header', () => {
      const { container } = renderInspector({ value: { key: 'value' } });
      const size = container.querySelector('.cinder-payload-inspector__size');
      expect(size?.textContent?.trim()).toMatch(/\d/);
      expect(size?.getAttribute('aria-label')).toContain('payload size');
    });
  });

  describe('object and array payloads', () => {
    test('renders objects as a JSON tree', () => {
      const { container } = renderInspector({ value: { key: 'value' } });
      expect(container.querySelector('.cinder-json-viewer')).not.toBeNull();
      expect(container.textContent).toContain('key');
    });

    test('renders arrays as a JSON tree', () => {
      const { container } = renderInspector({ value: [1, 2, 3] });
      expect(container.querySelector('.cinder-json-viewer')).not.toBeNull();
    });

    test('forwards initialDepth to the JSON tree', () => {
      const { container } = renderInspector({
        value: {
          webhook: {
            payload: {
              id: 'evt_123',
            },
          },
        },
        initialDepth: 2,
      });

      const webhookNode = container.querySelector<HTMLElement>(
        '[role="treeitem"][aria-label="webhook: object, 1 item"]',
      );
      const payloadNode = container.querySelector<HTMLElement>(
        '[role="treeitem"][aria-label="payload: object, 1 item"]',
      );

      expect(webhookNode?.getAttribute('aria-expanded')).toBe('true');
      expect(payloadNode?.getAttribute('aria-expanded')).toBe('false');
    });

    test('renders exactly one copy button whose value is pretty-printed JSON', () => {
      const { container } = renderInspector({ value: { hello: 'world' } });
      const copyButtons = container.querySelectorAll('.cinder-copy-button');
      expect(copyButtons).toHaveLength(1);
    });
  });

  describe('primitive values', () => {
    test('renders null inline', () => {
      const { container } = renderInspector({ value: null });
      const primitive = container.querySelector('.cinder-payload-inspector__primitive');
      expect(primitive?.textContent?.trim()).toBe('null');
    });

    test('renders booleans inline', () => {
      const { container } = renderInspector({ value: false });
      const primitive = container.querySelector('.cinder-payload-inspector__primitive');
      expect(primitive?.textContent?.trim()).toBe('false');
    });

    test('renders numbers inline', () => {
      const { container } = renderInspector({ value: 42 });
      const primitive = container.querySelector('.cinder-payload-inspector__primitive');
      expect(primitive?.textContent?.trim()).toBe('42');
    });

    test('renders string primitives inline without a tree', () => {
      const { container } = renderInspector({ value: 'hello' });
      const primitive = container.querySelector('.cinder-payload-inspector__primitive');
      expect(primitive?.textContent?.trim()).toBe('hello');
      expect(container.querySelector('.cinder-json-viewer')).toBeNull();
    });
  });

  describe('string value parsing', () => {
    test('parses a valid JSON object string into a tree', () => {
      const { container } = renderInspector({ value: '{"hello":"world"}' });
      expect(container.querySelector('.cinder-json-viewer')).not.toBeNull();
      expect(container.textContent).toContain('hello');
    });

    test('parses a valid JSON array string into a tree', () => {
      const { container } = renderInspector({ value: '[1,2,3]' });
      expect(container.querySelector('.cinder-json-viewer')).not.toBeNull();
    });

    test('copies a JSON-encoded string payload as the original quoted input, not the unquoted parsed result', async () => {
      const writeText = mock(async () => undefined);
      const originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText },
      });

      try {
        const { container } = renderInspector({ value: '"hello"' });
        const copyButton = container.querySelector<HTMLButtonElement>('.cinder-copy-button');
        expect(copyButton).not.toBeNull();

        await fireEvent.click(copyButton as HTMLButtonElement);

        expect(writeText).toHaveBeenCalledWith('"hello"');
        expect(writeText).not.toHaveBeenCalledWith('hello');
      } finally {
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          value: originalClipboard,
        });
      }
    });

    test('preserves a plain string as an inspectable value', () => {
      const { container } = renderInspector({ value: '--force' });
      const primitive = container.querySelector('.cinder-payload-inspector__primitive');
      expect(primitive?.textContent?.trim()).toBe('--force');
      expect(container.querySelector('[role="alert"]')).toBeNull();
    });

    test('preserves date-like plain strings as inspectable values', () => {
      const { container } = renderInspector({ value: '2026-06-26T12:00:00Z' });
      const primitive = container.querySelector('.cinder-payload-inspector__primitive');
      expect(primitive?.textContent?.trim()).toBe('2026-06-26T12:00:00Z');
      expect(container.querySelector('[role="alert"]')).toBeNull();
    });

    test('preserves keyword-prefixed plain strings as inspectable values', () => {
      const { container } = renderInspector({ value: 'true-ish' });
      const primitive = container.querySelector('.cinder-payload-inspector__primitive');
      expect(primitive?.textContent?.trim()).toBe('true-ish');
      expect(container.querySelector('[role="alert"]')).toBeNull();
    });

    test('treats empty string as null', () => {
      const { container } = renderInspector({ value: '' });
      const primitive = container.querySelector('.cinder-payload-inspector__primitive');
      expect(primitive?.textContent?.trim()).toBe('null');
    });

    test('shows a parse-error alert and the raw string for invalid JSON', () => {
      const { container } = renderInspector({ value: '{ invalid json' });
      const notice = container.querySelector(
        '.cinder-payload-inspector__notice--warning[role="alert"]',
      );
      expect(notice?.textContent).toContain('Parse error');
      const primitive = container.querySelector('.cinder-payload-inspector__primitive');
      expect(primitive?.textContent).toContain('{ invalid json');
    });

    test('copy button for invalid JSON copies the original string', () => {
      const { container } = renderInspector({ value: '{ invalid json' });
      const copyButtons = container.querySelectorAll('.cinder-copy-button');
      expect(copyButtons).toHaveLength(1);
    });

    test('custom parse function is applied for string values', () => {
      const customParse = (_raw: string) => ({ parsed: true });
      const { container } = renderInspector({
        value: 'custom-format-data',
        parse: customParse,
      });
      expect(container.querySelector('.cinder-json-viewer')).not.toBeNull();
      expect(container.textContent).toContain('parsed');
    });
  });

  describe('empty payload', () => {
    test('shows "No payload" when value is undefined', () => {
      const { container } = renderInspector({});
      const status = container.querySelector('[role="status"]');
      expect(status?.textContent?.trim()).toBe('No payload');
    });

    test('does not show a copy button for empty payload', () => {
      const { container } = renderInspector({});
      expect(container.querySelectorAll('.cinder-copy-button')).toHaveLength(0);
    });
  });

  describe('truncated payload', () => {
    test('shows Truncated badge in header when truncated=true', () => {
      const { container } = renderInspector({ value: { key: 'value' }, truncated: true });
      const badges = Array.from(container.querySelectorAll('.cinder-badge'));
      const truncatedBadge = badges.find((badge) => badge.textContent?.trim() === 'Truncated');
      expect(truncatedBadge).not.toBeNull();
    });
  });

  describe('unserializable values', () => {
    test('shows explanatory message (not JsonViewer) for BigInt values', () => {
      const { container } = renderInspector({ value: { amount: 9007199254740993n } });
      expect(container.textContent).toContain("can't be serialized as JSON");
      expect(container.querySelector('.cinder-json-viewer')).toBeNull();
    });

    test('shows explanatory message (not JsonViewer) for circular values', () => {
      const circular: Record<string, unknown> = { name: 'root' };
      circular['self'] = circular;
      const { container } = renderInspector({ value: circular });
      expect(container.textContent).toContain("can't be serialized as JSON");
      expect(container.querySelector('.cinder-json-viewer')).toBeNull();
    });

    test('does not render a copy button for an unserializable payload', () => {
      const circular: Record<string, unknown> = { name: 'cycle' };
      circular['self'] = circular;
      const { container } = renderInspector({ value: circular });
      expect(container.querySelectorAll('.cinder-copy-button')).toHaveLength(0);
    });
  });

  describe('CSS snapshot', () => {
    test('CSS file exists and contains cinder-payload-inspector', () => {
      const css = readFileSync(new URL('./payload-inspector.css', import.meta.url), 'utf8');
      expect(css).toContain('cinder-payload-inspector');
    });

    test('CSS file uses @layer cinder.components wrapper', () => {
      const css = readFileSync(new URL('./payload-inspector.css', import.meta.url), 'utf8');
      expect(css).toContain('@layer cinder.components');
    });

    test('CSS sidecar imports composed primitive styles', () => {
      const css = readFileSync(new URL('./payload-inspector.css', import.meta.url), 'utf8');

      expect(css).toContain("@import '../badge/badge.css';");
      expect(css).toContain("@import '../copy-button/copy-button.css';");
      expect(css).toContain("@import '../json-viewer/json-viewer.css';");
    });
  });
});
