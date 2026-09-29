import { setupHappyDom } from '@lostgradient/testing';
/// <reference lib="dom" />

import { describe, expect, test } from 'bun:test';

setupHappyDom();
const { render } = await import('@testing-library/svelte');

const { default: TreeSelectAll } = await import('../_tree-select-all/tree-select-all.svelte');
describe('Tree — selection', () => {
  test('TreeSelectAll outside tree context throws a clear usage error', () => {
    expect(() => render(TreeSelectAll, { props: {} })).toThrow(/missing_context/);
  });
});
