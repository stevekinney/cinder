/// <reference lib="dom" />
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { setupHappyDom } from '../../test/happy-dom.ts';

// setupHappyDom() MUST run before any `@testing-library/svelte` import. testing-library
// reads `globalThis.document` / `window` at module-init (top-level, not inside test bodies),
// so we register happy-dom's globals first and then dynamic-import testing-library below.
setupHappyDom();

const { render, fireEvent, cleanup } = await import('@testing-library/svelte');
const { default: PayloadInspector } = await import('./payload-inspector.svelte');

beforeEach(() => document.body.replaceChildren());
afterEach(() => cleanup());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderInspector(props: Record<string, unknown> = {}) {
  return render(PayloadInspector, props);
}

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

describe('PayloadInspector', () => {
  describe('structure', () => {
    test('renders root element with cinder-payload-inspector class', () => {
      const { container } = renderInspector({ value: { key: 'value' } });
      const root = container.querySelector('.cinder-payload-inspector');
      expect(root).not.toBeNull();
    });

    test('renders as a <section> element', () => {
      const { container } = renderInspector({ value: { key: 'value' } });
      const root = container.querySelector('.cinder-payload-inspector');
      expect(root?.tagName.toLowerCase()).toBe('section');
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

    test('renders tab list with three tabs', () => {
      const { container } = renderInspector({ value: { hello: 'world' } });
      const tabList = container.querySelector('[role="tablist"]');
      expect(tabList).not.toBeNull();
      const tabs = container.querySelectorAll('[role="tab"]');
      expect(tabs.length).toBe(3);
    });

    test('tabs are labeled Summary, Tree, and Raw', () => {
      const { getByText } = renderInspector({ value: { hello: 'world' } });
      expect(getByText('Summary')).not.toBeNull();
      expect(getByText('Tree')).not.toBeNull();
      expect(getByText('Raw')).not.toBeNull();
    });

    test('Summary tab is selected by default', () => {
      const { container } = renderInspector({ value: { hello: 'world' } });
      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      const summaryTab = tabs.find((t) => t.textContent?.trim() === 'Summary');
      expect(summaryTab?.getAttribute('aria-selected')).toBe('true');
    });
  });

  // ---------------------------------------------------------------------------
  // Object/array payloads
  // ---------------------------------------------------------------------------

  describe('object and array payloads', () => {
    test('shows "object" kind badge for object values', () => {
      const { container } = renderInspector({ value: { key: 'value' } });
      const badge = container.querySelector('.cinder-badge');
      expect(badge?.textContent?.trim()).toBe('object');
    });

    test('shows "array" kind badge for array values', () => {
      const { container } = renderInspector({ value: [1, 2, 3] });
      const badge = container.querySelector('.cinder-badge');
      expect(badge?.textContent?.trim()).toBe('array');
    });

    test('renders byte size in header', () => {
      const { container } = renderInspector({ value: { key: 'value' } });
      const size = container.querySelector('.cinder-payload-inspector__size');
      expect(size?.textContent?.trim()).toMatch(/\d/);
    });

    test('shows copy buttons for non-empty valid payloads', () => {
      const { container } = renderInspector({ value: { key: 'value' } });
      const copyButtons = container.querySelectorAll('.cinder-copy-button');
      expect(copyButtons.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Primitive values
  // ---------------------------------------------------------------------------

  describe('primitive values', () => {
    test('shows "null" kind badge for null', () => {
      const { container } = renderInspector({ value: null });
      const badge = container.querySelector('.cinder-badge');
      expect(badge?.textContent?.trim()).toBe('null');
    });

    test('shows "boolean" kind badge for boolean', () => {
      const { container } = renderInspector({ value: true });
      const badge = container.querySelector('.cinder-badge');
      expect(badge?.textContent?.trim()).toBe('boolean');
    });

    test('shows "number" kind badge for number', () => {
      const { container } = renderInspector({ value: 42 });
      const badge = container.querySelector('.cinder-badge');
      expect(badge?.textContent?.trim()).toBe('number');
    });

    test('shows "string" kind badge for a JS string primitive value', () => {
      // To pass a raw string primitive (not JSON-encoded), use a non-string JS value
      // type. When value is a JS string, the component attempts JSON.parse on it.
      // A plain non-JSON string yields "invalid" since it fails parsing.
      // A JSON-encoded string like '"hello"' (with quotes) parses to a string primitive.
      const { container } = renderInspector({ value: '"hello"' });
      const badge = container.querySelector('.cinder-badge');
      expect(badge?.textContent?.trim()).toBe('string');
    });

    test('shows primitive value inline in summary for null', () => {
      const { container } = renderInspector({ value: null });
      const primitive = container.querySelector('.cinder-payload-inspector__primitive');
      expect(primitive?.textContent?.trim()).toBe('null');
    });

    test('shows primitive value inline for boolean', () => {
      const { container } = renderInspector({ value: false });
      const primitive = container.querySelector('.cinder-payload-inspector__primitive');
      expect(primitive?.textContent?.trim()).toBe('false');
    });
  });

  // ---------------------------------------------------------------------------
  // String input (JSON parsing)
  // ---------------------------------------------------------------------------

  describe('string value parsing', () => {
    test('parses a valid JSON string and shows "object" kind', () => {
      const { container } = renderInspector({ value: '{"hello":"world"}' });
      const badge = container.querySelector('.cinder-badge');
      expect(badge?.textContent?.trim()).toBe('object');
    });

    test('parses a valid JSON array string', () => {
      const { container } = renderInspector({ value: '[1,2,3]' });
      const badge = container.querySelector('.cinder-badge');
      expect(badge?.textContent?.trim()).toBe('array');
    });

    test('treats empty string as null', () => {
      const { container } = renderInspector({ value: '' });
      const badge = container.querySelector('.cinder-badge');
      expect(badge?.textContent?.trim()).toBe('null');
    });

    test('shows "invalid" kind badge for invalid JSON string', () => {
      const { container } = renderInspector({ value: '{ invalid json' });
      const badge = container.querySelector('.cinder-badge');
      expect(badge?.textContent?.trim()).toBe('invalid');
    });

    test('shows parse error notice in summary for invalid JSON', () => {
      const { container } = renderInspector({ value: '{ invalid json' });
      const notice = container.querySelector(
        '.cinder-payload-inspector__notice--warning[role="alert"]',
      );
      expect(notice?.textContent).toContain('Parse error');
    });

    test('shows raw string in raw view for invalid JSON', async () => {
      const { container } = renderInspector({ value: '{ invalid json' });
      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      const rawTab = tabs.find((t) => t.textContent?.trim() === 'Raw');
      await fireEvent.click(rawTab!);
      const code = container.querySelector(
        '.cinder-payload-inspector__raw .cinder-code-block__code',
      );
      expect(code?.textContent).toContain('{ invalid json');
    });
  });

  // ---------------------------------------------------------------------------
  // Empty / undefined payload
  // ---------------------------------------------------------------------------

  describe('empty payload', () => {
    test('shows "No payload" when value is undefined', () => {
      const { container } = renderInspector({});
      expect(container.textContent).toContain('No payload');
    });

    test('does not show copy buttons for empty payload', () => {
      const { container } = renderInspector({});
      const copyButtons = container.querySelectorAll('.cinder-copy-button');
      expect(copyButtons.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Truncated state
  // ---------------------------------------------------------------------------

  describe('truncated payload', () => {
    test('shows Truncated badge in header when truncated=true', () => {
      const { container } = renderInspector({ value: { key: 'value' }, truncated: true });
      const badges = Array.from(container.querySelectorAll('.cinder-badge'));
      const truncatedBadge = badges.find((b) => b.textContent?.trim() === 'Truncated');
      expect(truncatedBadge).not.toBeNull();
    });

    test('shows Truncated badge in summary badges row when truncated=true', () => {
      const { container } = renderInspector({ value: { key: 'value' }, truncated: true });
      const summaryBadges = container.querySelector('.cinder-payload-inspector__summary-badges');
      expect(summaryBadges?.textContent).toContain('Truncated');
    });
  });

  // ---------------------------------------------------------------------------
  // Metadata (DescriptionList)
  // ---------------------------------------------------------------------------

  describe('metadata', () => {
    test('shows content type in summary description list', () => {
      const { container } = renderInspector({
        value: { hello: 'world' },
        meta: { contentType: 'application/json' },
      });
      expect(container.textContent).toContain('Content type');
      expect(container.textContent).toContain('application/json');
    });

    test('shows source in summary description list', () => {
      const { container } = renderInspector({
        value: { hello: 'world' },
        meta: { source: 'my-workflow' },
      });
      expect(container.textContent).toContain('Source');
      expect(container.textContent).toContain('my-workflow');
    });

    test('shows size in summary description list', () => {
      const { container } = renderInspector({ value: { hello: 'world' } });
      expect(container.textContent).toContain('Size');
    });
  });

  // ---------------------------------------------------------------------------
  // Tab navigation behavior
  // ---------------------------------------------------------------------------

  describe('behavior', () => {
    test('clicking Tree tab activates it', async () => {
      const { container } = renderInspector({ value: { hello: 'world' } });
      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      const treeTab = tabs.find((t) => t.textContent?.trim() === 'Tree');
      await fireEvent.click(treeTab!);
      expect(treeTab?.getAttribute('aria-selected')).toBe('true');
    });

    test('clicking Raw tab shows CodeBlock element', async () => {
      const { container } = renderInspector({ value: { hello: 'world' } });
      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      const rawTab = tabs.find((t) => t.textContent?.trim() === 'Raw');
      await fireEvent.click(rawTab!);
      const codeBlock = container.querySelector('.cinder-payload-inspector__raw');
      expect(codeBlock).not.toBeNull();
    });

    test('raw view contains the formatted JSON text', async () => {
      const { container } = renderInspector({ value: { hello: 'world' } });
      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      const rawTab = tabs.find((t) => t.textContent?.trim() === 'Raw');
      await fireEvent.click(rawTab!);
      const code = container.querySelector(
        '.cinder-payload-inspector__raw .cinder-code-block__code',
      );
      expect(code?.textContent).toContain('hello');
      expect(code?.textContent).toContain('world');
    });

    test('custom format function is applied in raw view display', async () => {
      // `format` customizes how the raw view serializes the value — e.g. sorted
      // keys or custom indentation. It is a display serializer, not a redaction
      // hook. Redaction should be applied upstream (pass value={redact(payload)}).
      const customFormat = (_v: unknown) => JSON.stringify({ sorted: true });
      const { container } = renderInspector({
        value: { b: 2, a: 1 },
        format: customFormat,
      });
      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      const rawTab = tabs.find((t) => t.textContent?.trim() === 'Raw');
      await fireEvent.click(rawTab!);
      const code = container.querySelector(
        '.cinder-payload-inspector__raw .cinder-code-block__code',
      );
      expect(code?.textContent?.trim()).toContain('sorted');
    });

    test('Raw tab shows explanatory message for BigInt (unserializable) value', async () => {
      const { container } = renderInspector({ value: { amount: 9007199254740993n } });
      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      const rawTab = tabs.find((t) => t.textContent?.trim() === 'Raw');
      await fireEvent.click(rawTab!);
      expect(container.textContent).toContain("can't be serialized as JSON");
      expect(container.querySelector('.cinder-payload-inspector__raw')).toBeNull();
    });

    test('Raw tab shows explanatory message for circular reference (unserializable) value', async () => {
      const circular: Record<string, unknown> = { name: 'root' };
      circular['self'] = circular;
      const { container } = renderInspector({ value: circular });
      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      const rawTab = tabs.find((t) => t.textContent?.trim() === 'Raw');
      await fireEvent.click(rawTab!);
      expect(container.textContent).toContain("can't be serialized as JSON");
      expect(container.querySelector('.cinder-payload-inspector__raw')).toBeNull();
    });

    test('Tree tab shows explanatory message (not JsonViewer) for BigInt value', async () => {
      // Regression: the Tree tab used to pass unserializable values straight to
      // JsonViewer. It must degrade with the same notice the Raw tab shows.
      const { container } = renderInspector({ value: { amount: 9007199254740993n } });
      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      const treeTab = tabs.find((t) => t.textContent?.trim() === 'Tree');
      await fireEvent.click(treeTab!);
      expect(container.textContent).toContain("can't be serialized as JSON");
      expect(container.querySelector('.cinder-json-viewer')).toBeNull();
    });

    test('Tree tab shows explanatory message (not JsonViewer) for circular value', async () => {
      const circular: Record<string, unknown> = { name: 'root' };
      circular['self'] = circular;
      const { container } = renderInspector({ value: circular });
      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      const treeTab = tabs.find((t) => t.textContent?.trim() === 'Tree');
      await fireEvent.click(treeTab!);
      expect(container.textContent).toContain("can't be serialized as JSON");
      expect(container.querySelector('.cinder-json-viewer')).toBeNull();
    });

    test('renders two distinct copy buttons for an object payload', () => {
      // copy-raw = compact one-liner; copy-formatted = indented.
      // Both buttons should be present; their underlying copy values differ.
      const { container } = renderInspector({ value: { hello: 'world' } });
      const copyButtons = container.querySelectorAll('.cinder-copy-button');
      expect(copyButtons.length).toBeGreaterThanOrEqual(2);
    });

    test('custom parse function is applied for string values', () => {
      const customParse = (_raw: string) => ({ parsed: true });
      const { container } = renderInspector({
        value: 'custom-format-data',
        parse: customParse,
      });
      const badge = container.querySelector('.cinder-badge');
      expect(badge?.textContent?.trim()).toBe('object');
    });

    test('activeView prop sets initial active tab', () => {
      const { container } = renderInspector({
        value: { key: 'val' },
        activeView: 'raw',
      });
      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      const rawTab = tabs.find((t) => t.textContent?.trim() === 'Raw');
      expect(rawTab?.getAttribute('aria-selected')).toBe('true');
    });
  });

  // ---------------------------------------------------------------------------
  // Accessibility
  // ---------------------------------------------------------------------------

  describe('accessibility', () => {
    test('section has aria-label set to the label prop', () => {
      const { container } = renderInspector({
        value: { key: 'val' },
        label: 'My inspector',
      });
      const section = container.querySelector('section.cinder-payload-inspector');
      expect(section?.getAttribute('aria-label')).toBe('My inspector');
    });

    test('label prop remains authoritative over consumer aria-label', () => {
      const { container } = renderInspector({
        value: { key: 'val' },
        label: 'Visible inspector',
        'aria-label': 'Consumer inspector',
      } as never);
      const section = container.querySelector('section.cinder-payload-inspector');
      expect(section?.getAttribute('aria-label')).toBe('Visible inspector');
    });

    test('tab list has label "Inspector views"', () => {
      const { container } = renderInspector({ value: {} });
      const tabList = container.querySelector('[role="tablist"]');
      expect(tabList?.getAttribute('aria-label')).toBe('Inspector views');
    });

    test('each tab has role="tab"', () => {
      const { container } = renderInspector({ value: {} });
      const tabs = container.querySelectorAll('[role="tab"]');
      expect(tabs.length).toBe(3);
    });

    test('each tab has aria-selected', () => {
      const { container } = renderInspector({ value: {} });
      const tabs = Array.from(container.querySelectorAll('[role="tab"]'));
      for (const tab of tabs) {
        expect(tab.hasAttribute('aria-selected')).toBe(true);
      }
    });

    test('active tab panel has role="tabpanel"', () => {
      const { container } = renderInspector({ value: {} });
      const panel = container.querySelector('[role="tabpanel"]');
      expect(panel).not.toBeNull();
    });

    test('parse error notice has role="alert"', () => {
      const { container } = renderInspector({ value: '{ bad json' });
      const alert = container.querySelector('[role="alert"]');
      expect(alert).not.toBeNull();
      expect(alert?.textContent).toContain('Parse error');
    });

    test('empty state has role="status"', () => {
      const { container } = renderInspector({});
      const status = container.querySelector('[role="status"]');
      expect(status).not.toBeNull();
      expect(status?.textContent?.trim()).toBe('No payload');
    });

    test('size label has aria-label for screen readers', () => {
      const { container } = renderInspector({ value: { key: 'value' } });
      const size = container.querySelector('.cinder-payload-inspector__size');
      expect(size?.getAttribute('aria-label')).toContain('payload size');
    });

    test('keyboard: ArrowRight moves focus to next tab', async () => {
      const { container } = renderInspector({ value: { key: 'val' } });
      const tabs = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
      const summaryTab = tabs.find((t) => t.textContent?.trim() === 'Summary');
      summaryTab?.focus();
      await fireEvent.keyDown(summaryTab!, { key: 'ArrowRight' });
      const treeTab = tabs.find((t) => t.textContent?.trim() === 'Tree');
      expect(treeTab?.getAttribute('aria-selected')).toBe('true');
    });

    test('keyboard: ArrowLeft moves focus to previous tab', async () => {
      const { container } = renderInspector({ value: { key: 'val' }, activeView: 'raw' });
      const tabs = Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'));
      const rawTab = tabs.find((t) => t.textContent?.trim() === 'Raw');
      rawTab?.focus();
      await fireEvent.keyDown(rawTab!, { key: 'ArrowLeft' });
      const treeTab = tabs.find((t) => t.textContent?.trim() === 'Tree');
      expect(treeTab?.getAttribute('aria-selected')).toBe('true');
    });
  });

  // ---------------------------------------------------------------------------
  // CSS snapshot
  // ---------------------------------------------------------------------------

  describe('CSS snapshot', () => {
    test('CSS file exists and contains cinder-payload-inspector', () => {
      const css = readFileSync(new URL('./payload-inspector.css', import.meta.url), 'utf8');
      expect(css).toContain('cinder-payload-inspector');
    });

    test('CSS file uses @layer cinder.components wrapper', () => {
      const css = readFileSync(new URL('./payload-inspector.css', import.meta.url), 'utf8');
      expect(css).toContain('@layer cinder.components');
    });

    test('CSS file includes focus-visible rule', () => {
      const css = readFileSync(new URL('./payload-inspector.css', import.meta.url), 'utf8');
      expect(css).toContain(':focus-visible');
    });
  });
});
