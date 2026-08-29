/// <reference lib="dom" />
import { afterEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createRawSnippet } from 'svelte';

import { setupHappyDom } from '../../test/happy-dom.ts';

setupHappyDom();

const { cleanup, render } = await import('@testing-library/svelte');
const { default: ModalRegion } = await import('./modal-region.svelte');
const { default: ModalRegionHost } = await import('./modal-region-host.test.svelte');
type ModalApi = import('../../_internal/modal-context.ts').ModalApi;

afterEach(cleanup);

describe('ModalRegion', () => {
  test('standalone entrypoint imports Button styles for confirmations', () => {
    const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
    expect(source).toContain("import '../button/button.css';");
  });

  test('renders its context-scoped application children without adding wrapper markup', () => {
    const children = createRawSnippet(() => ({
      render: () => '<button data-testid="application">Open modal</button>',
    }));
    const { container } = render(ModalRegion, { children });

    expect(container.querySelector('[data-testid="application"]')?.textContent).toBe('Open modal');
    expect(container.children).toHaveLength(1);
  });

  test('resolves confirmation as false after the region is destroyed', async () => {
    let api: ModalApi | undefined;
    const { unmount } = render(ModalRegionHost, {
      onReady: (value: ModalApi) => {
        api = value;
      },
    });

    expect(api).toBeDefined();
    unmount();

    await expect(api!.confirm({ title: 'Confirm action' })).resolves.toBe(false);
  });

  test('exposes dedicated title and scoped custom-content controls', () => {
    const source = readFileSync(new URL('./modal-region.svelte', import.meta.url), 'utf8');
    expect(source).toContain('title: options.title');
    expect(source).toContain('modal={{');
  });

  test('canonical example consumes modal context and opens a confirmation', () => {
    const example = readFileSync(
      new URL(
        '../../../../playground/src/examples/modal-region/basic.example.svelte',
        import.meta.url,
      ),
      'utf8',
    );
    expect(example).toContain('useModal()');
    expect(example).toContain('modal.confirm(');
  });

  test('deduplicates only unsettled requests and keys exit instances uniquely', () => {
    const source = readFileSync(new URL('./modal-region.svelte', import.meta.url), 'utf8');
    expect(source).toContain('entry.id === id && !entry.settled');
    expect(source).toContain('key: ++sequence');
    expect(source).toContain('{#each entries as entry (entry.key)}');
    expect(source).toContain('entries.filter((entry) => entry.key !== key)');
    expect(source).toContain('onExitComplete={() => remove(entry.key)}');
    expect(source).toContain(
      'candidate.id === id && candidate.promise === promise && !candidate.settled',
    );
    expect(source).toContain('resolve: (value: unknown) => finishEntry(entry.key, value)');
    expect(source).toContain('close: () => finishEntry(entry.key, undefined)');
  });

  test('reopened stable-id confirmations bind callbacks to the new promise entry', () => {
    const source = readFileSync(new URL('./modal-region.svelte', import.meta.url), 'utf8');
    expect(source).toContain(
      'candidate.id === id && candidate.promise === promise && !candidate.settled',
    );
    expect(source).toContain("entry.props['onConfirm'] = () => finishEntry(entry.key, true)");
    expect(source).toContain("entry.props['onCancel'] = () => finishEntry(entry.key, false)");
  });

  test('does not repurpose an active custom modal when confirming the same stable id', () => {
    const source = readFileSync(new URL('./modal-region.svelte', import.meta.url), 'utf8');
    expect(source).toContain(
      'if (existing && !existing.confirmation) return Promise.resolve(false);',
    );
  });

  test('resolves custom modal dismissal paths as undefined', () => {
    const source = readFileSync(new URL('./modal-region.svelte', import.meta.url), 'utf8');
    expect(source).toContain('dismiss(id) {\n      finish(id, undefined);');
    expect(source).toContain('onDismiss={() => finishEntry(entry.key, undefined)}');
    expect(source).toContain(
      'onDismiss={() => finishEntry(entry.key, entry.confirmation ? false : undefined)}',
    );
  });
});
