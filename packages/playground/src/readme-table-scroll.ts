import type { Element as HastElement, Parent as HastParent } from 'hast';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';

export function wrapReadmeTables(html: string): string {
  const tree = fromHtml(html, { fragment: true });

  const wrapChildren = (parent: HastParent): void => {
    parent.children = parent.children.map((child) => {
      if (child.type !== 'element') return child;
      const element = child as HastElement;
      if (element.tagName === 'table') {
        return {
          type: 'element',
          tagName: 'div',
          properties: {
            className: ['readme-table-scroll'],
            role: 'region',
            'aria-label': 'README table',
            tabIndex: 0,
          },
          children: [element],
        } satisfies HastElement;
      }
      wrapChildren(element);
      return element;
    });
  };

  wrapChildren(tree);
  return toHtml(tree);
}
