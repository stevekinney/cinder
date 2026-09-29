import { requiredInstance, setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { treeItem } from './tree-test-helpers.ts';

setupHappyDom();
const { render, fireEvent, waitFor } = await import('@testing-library/svelte');

const { default: TreeItem } = await import('../tree-item/tree-item.svelte');
const { default: TreeTestHarness } = await import('../_tree-test-harness.svelte');
describe('Tree — async loading', () => {
  test('expanding a branch with loadChildren sets aria-busy="true" while pending', async () => {
    let resolveLoad!: () => void;
    const loadChildren = () =>
      new Promise<void>((resolve) => {
        resolveLoad = resolve;
      });

    const { container } = render(TreeTestHarness, {
      props: {
        'aria-label': 'T',
        children: createRawSnippet(() => ({
          render: () => `<div class="w"></div>`,
          setup: (node: Element) => {
            const inst = mount(TreeItem, {
              target: node,
              props: { id: 'async-branch', label: 'Branch', loadChildren },
            });
            return () => unmount(inst);
          },
        })),
      },
    });

    const item = requiredInstance(container.querySelector('[role="treeitem"]'), HTMLElement);
    item.focus();
    await fireEvent.keyDown(item, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    });

    resolveLoad();
    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')?.outerHTML ?? null).toBeNull();
    });
  });

  test('loader rejection invokes onLoadError and collapses branch', async () => {
    const errors: Array<{ error: unknown; id: string }> = [];
    const loadError = new Error('fetch failed');

    const { container } = render(TreeTestHarness, {
      props: {
        'aria-label': 'T',
        children: createRawSnippet(() => ({
          render: () => `<div class="w"></div>`,
          setup: (node: Element) => {
            const inst = mount(TreeItem, {
              target: node,
              props: {
                id: 'error-branch',
                label: 'Error Branch',
                loadChildren: async () => {
                  throw loadError;
                },
                onLoadError: (error: unknown, id: string) => errors.push({ error, id }),
              },
            });
            return () => unmount(inst);
          },
        })),
      },
    });

    const item = requiredInstance(container.querySelector('[role="treeitem"]'), HTMLElement);
    item.focus();
    await fireEvent.keyDown(item, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(errors.length).toBe(1);
      expect(errors[0]?.error).toBe(loadError);
      expect(errors[0]?.id).toBe('error-branch');
    });

    flushSync();
    expect(container.querySelector('[aria-expanded="true"]')?.outerHTML ?? null).toBeNull();
  });

  test('when onLoadError is absent, console.error is called with [cinder-tree] prefix', async () => {
    const errorMessages: string[] = [];
    const originalError = console.error;
    console.error = (...args: unknown[]) => {
      errorMessages.push(args.join(' '));
    };

    try {
      const { container } = render(TreeTestHarness, {
        props: {
          'aria-label': 'T',
          children: createRawSnippet(() => ({
            render: () => `<div class="w"></div>`,
            setup: (node: Element) => {
              const inst = mount(TreeItem, {
                target: node,
                props: {
                  id: 'nohandler-branch',
                  label: 'NoHandler',
                  loadChildren: async () => {
                    throw new Error('unhandled');
                  },
                },
              });
              return () => unmount(inst);
            },
          })),
        },
      });

      const item = requiredInstance(container.querySelector('[role="treeitem"]'), HTMLElement);
      item.focus();
      await fireEvent.keyDown(item, { key: 'ArrowRight' });

      await waitFor(() => {
        expect(errorMessages.some((m) => m.includes('[cinder-tree]'))).toBe(true);
      });
    } finally {
      console.error = originalError;
    }
  });

  test('collapsing during load aborts without calling onLoadError', async () => {
    const errors: unknown[] = [];
    let aborted = false;
    const loadChildren = ({ signal }: { id: string; signal: AbortSignal }) =>
      new Promise<void>((_resolve, _reject) => {
        signal.addEventListener('abort', () => {
          aborted = true;
        });
        // never resolves — simulates a hung request
      });

    const { container } = render(TreeTestHarness, {
      props: {
        'aria-label': 'T',
        children: createRawSnippet(() => ({
          render: () => `<div class="w"></div>`,
          setup: (node: Element) => {
            const inst = mount(TreeItem, {
              target: node,
              props: {
                id: 'abort-branch',
                label: 'Abort Branch',
                loadChildren,
                onLoadError: (error: unknown) => errors.push(error),
              },
            });
            return () => unmount(inst);
          },
        })),
      },
    });

    const item = requiredInstance(container.querySelector('[role="treeitem"]'), HTMLElement);
    item.focus();
    // Expand to start loading
    await fireEvent.keyDown(item, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    });
    // Collapse to abort
    await fireEvent.keyDown(item, { key: 'ArrowLeft' });
    flushSync();
    expect(container.querySelector('[aria-busy="true"]')?.outerHTML ?? null).toBeNull();
    expect(aborted).toBe(true);
    expect(errors).toHaveLength(0);
  });

  test('loadChildren is not re-invoked after successful load', async () => {
    let callCount = 0;
    const loadChildren = async () => {
      callCount++;
    };

    const { container } = render(TreeTestHarness, {
      props: {
        'aria-label': 'T',
        children: createRawSnippet(() => ({
          render: () => `<div class="w"></div>`,
          setup: (node: Element) => {
            const inst = mount(TreeItem, {
              target: node,
              props: { id: 'reload-branch', label: 'Reload Branch', loadChildren },
            });
            return () => unmount(inst);
          },
        })),
      },
    });

    const item = requiredInstance(container.querySelector('[role="treeitem"]'), HTMLElement);
    // Expand
    item.focus();
    await fireEvent.keyDown(item, { key: 'ArrowRight' });
    await waitFor(() => expect(callCount).toBe(1));
    // Collapse
    await fireEvent.keyDown(item, { key: 'ArrowLeft' });
    await waitFor(() => {
      const reloadItem = treeItem(container, 'Reload Branch');
      expect(reloadItem?.getAttribute('aria-expanded')).toBe('false');
    });
    // Expand again
    await fireEvent.keyDown(item, { key: 'ArrowRight' });
    // Give time for any re-trigger
    await new Promise((resolve) => setTimeout(resolve, 50));
    // Should still be 1, not 2
    expect(callCount).toBe(1);
  });
});
