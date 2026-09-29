/// <reference lib="dom" />
import { describe, expect, test } from 'bun:test';

import { setupHappyDom } from '@lostgradient/testing';
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
    const first = document.createElement('button');
    const second = document.createElement('button');
    first.compareDocumentPosition = () => 0;
    second.compareDocumentPosition = () => 0;
    const items = [
      { id: 'first', node: first },
      { id: 'second', node: second },
    ];

    expect(inDocumentOrder(items).map((item) => item.id)).toEqual(['first', 'second']);
  });

  test('sorts nodes after a following sibling when compareDocumentPosition reports preceding', () => {
    const first = document.createElement('button');
    const second = document.createElement('button');
    second.compareDocumentPosition = (candidate: Node) => (candidate === first ? 0x02 : 0);
    first.compareDocumentPosition = (candidate: Node) => (candidate === second ? 0x04 : 0);
    const items = [
      { id: 'second', node: second },
      { id: 'first', node: first },
    ];

    expect(inDocumentOrder(items).map((item) => item.id)).toEqual(['first', 'second']);
  });
});
