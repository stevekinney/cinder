/// <reference lib="dom" />
import { setupHappyDom } from '@lostgradient/testing';
import type { Snippet } from 'svelte';
import { createRawSnippet, mount, tick, unmount } from 'svelte';

setupHappyDom();

const { default: TreeItem } = await import('../tree-item/tree-item.svelte');

type TreeItemMountProps = {
  id: string;
  label: string;
  disabled?: boolean;
  branch?: boolean;
  selectionScopeIds?: string[];
  children?: Snippet;
  row?: Snippet<
    [
      {
        expanded: boolean;
        selected: boolean;
        busy: boolean;
        level: number;
        checkboxSelection: boolean;
        selectionState: { checked: boolean; indeterminate: boolean };
        toggleSelection: () => void;
      },
    ]
  >;
};

export function textSnippet(text: string) {
  return createRawSnippet(() => ({
    render: () => `<span>${text}</span>`,
    setup: () => {},
  }));
}

export function treeItem(container: HTMLElement, label: string): HTMLElement | null {
  const labelElement = [...container.querySelectorAll<HTMLElement>('.cinder-sr-only')].find(
    (element) => element.textContent === label,
  );

  if (!labelElement?.id) return null;
  return container.querySelector<HTMLElement>(
    `[role="treeitem"][aria-labelledby="${labelElement.id}"]`,
  );
}

export function visibleTreeItemLabels(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')]
    .filter((element) => !element.hasAttribute('data-cinder-hidden'))
    .map((element) => {
      const labelId = element.getAttribute('aria-labelledby');
      const localLabel = [...container.querySelectorAll<HTMLElement>('[id]')].find(
        (candidate) => candidate.id === labelId,
      );
      return labelId
        ? (localLabel?.textContent ??
            container.ownerDocument.getElementById(labelId)?.textContent ??
            '')
        : '';
    })
    .filter(Boolean);
}

export async function flushTreeFilterStatus(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 520));
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  await tick();
}

export function treeItemsSnippet(
  items: Array<{
    id: string;
    label: string;
    disabled?: boolean;
    branch?: boolean;
    selectionScopeIds?: string[];
    children?: Array<{ id: string; label: string; disabled?: boolean }>;
  }>,
) {
  return createRawSnippet(() => ({
    render: () => `<div class="items-wrapper"></div>`,
    setup: (node: Element) => {
      const instances: ReturnType<typeof mount>[] = [];

      for (const item of items) {
        const childrenSnippet = item.children
          ? createRawSnippet(() => ({
              render: () => `<div class="children-wrapper"></div>`,
              setup: (childNode: Element) => {
                const childInstances: ReturnType<typeof mount>[] = [];
                for (const child of item.children ?? []) {
                  const childProps = {
                    id: child.id,
                    label: child.label,
                    ...(child.disabled !== undefined && { disabled: child.disabled }),
                  } satisfies TreeItemMountProps;
                  childInstances.push(
                    mount(TreeItem, {
                      target: childNode,
                      props: childProps,
                    }),
                  );
                }
                return () => {
                  for (const ci of childInstances) void unmount(ci);
                };
              },
            }))
          : undefined;

        const itemProps = {
          id: item.id,
          label: item.label,
          ...(item.disabled !== undefined && { disabled: item.disabled }),
          ...(item.branch !== undefined && { branch: item.branch }),
          ...(item.selectionScopeIds && { selectionScopeIds: item.selectionScopeIds }),
          ...(childrenSnippet && { children: childrenSnippet }),
        } satisfies TreeItemMountProps;
        instances.push(
          mount(TreeItem, {
            target: node,
            props: itemProps,
          }),
        );
      }
      return () => {
        for (const inst of instances) void unmount(inst);
      };
    },
  }));
}
