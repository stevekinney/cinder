import { setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';
import { textSnippet, treeItemsSnippet } from './tree-test-helpers.ts';

setupHappyDom();
const { render } = await import('@testing-library/svelte');
const { default: Tree } = await import('./tree.svelte');

describe('Tree — structure and ARIA', () => {
  test('tree contains zero <li> elements', () => {
    const { container } = render(Tree, {
      props: {
        'aria-label': 'T',
        expandedIds: ['parent'],
        children: treeItemsSnippet([
          {
            id: 'parent',
            label: 'Parent',
            branch: true,
            children: [{ id: 'child', label: 'Child' }],
          },
        ]),
      },
    });
    expect(container.querySelectorAll('li').length).toBe(0);
  });

  test('warns when neither aria-label nor aria-labelledby is provided', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.join(' '));
    };

    try {
      render(Tree, {
        props: { children: textSnippet('') },
      });
      expect(warnings.some((w) => w.includes('[cinder-tree]'))).toBe(true);
    } finally {
      console.warn = originalWarn;
    }
  });

  test('warns and omits accessible-name attributes when labels are empty after trimming', () => {
    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.join(' '));
    };

    try {
      const { container } = render(Tree, {
        props: {
          'aria-label': '   ',
          'aria-labelledby': '   ',
          children: textSnippet(''),
        },
      });
      const tree = container.querySelector<HTMLElement>('[role="tree"]');

      expect(warnings.some((warning) => warning.includes('[cinder-tree]'))).toBe(true);
      expect(tree?.hasAttribute('aria-label')).toBe(false);
      expect(tree?.hasAttribute('aria-labelledby')).toBe(false);
    } finally {
      console.warn = originalWarn;
    }
  });
});
