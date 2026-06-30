/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '../test/happy-dom.ts';
import { inDocumentOrder } from './document-order.ts';

setupHappyDom();

describe('inDocumentOrder', () => {
  test('sorts connected nodes by document order without mutating the input', () => {
    const first = document.createElement('button');
    const second = document.createElement('button');
    document.body.append(first, second);
    const items = [
      { id: 'second', node: second },
      { id: 'first', node: first },
    ];

    expect(inDocumentOrder(items).map((item) => item.id)).toEqual(['first', 'second']);
    expect(items.map((item) => item.id)).toEqual(['second', 'first']);

    first.remove();
    second.remove();
  });

  test('keeps nodes stable when compareDocumentPosition reports no order', () => {
    const first = {
      compareDocumentPosition: () => 0,
    } as unknown as Node;
    const second = {
      compareDocumentPosition: () => 0,
    } as unknown as Node;
    const items = [
      { id: 'first', node: first },
      { id: 'second', node: second },
    ];

    expect(inDocumentOrder(items).map((item) => item.id)).toEqual(['first', 'second']);
  });

  test('sorts nodes after a following sibling when compareDocumentPosition reports preceding', () => {
    let first: Node;
    const second = {
      compareDocumentPosition: (candidate: Node) => (candidate === first ? 0x02 : 0),
    } as unknown as Node;
    first = {
      compareDocumentPosition: (candidate: Node) => (candidate === second ? 0x04 : 0),
    } as unknown as Node;
    const items = [
      { id: 'second', node: second },
      { id: 'first', node: first },
    ];

    expect(inDocumentOrder(items).map((item) => item.id)).toEqual(['first', 'second']);
  });
});
