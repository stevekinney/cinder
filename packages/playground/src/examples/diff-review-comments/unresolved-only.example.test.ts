/// <reference lib="dom" />
import { afterEach, expect, test } from 'bun:test';
import { compile } from 'svelte/compiler';

import { setupHappyDom } from '@lostgradient/testing';

setupHappyDom();

const { cleanup, fireEvent, render, screen } = await import('@testing-library/svelte');
const { default: UnresolvedOnlyExample } = await import('./unresolved-only.example.svelte');

afterEach(cleanup);

test('compiles without reactive-state or other Svelte warnings', async () => {
  const source = await Bun.file(
    new URL('./unresolved-only.example.svelte', import.meta.url),
  ).text();
  const result = compile(source, {
    filename: 'unresolved-only.example.svelte',
    generate: 'client',
  });
  expect(result.warnings).toEqual([]);
});

test('seeds an unresolved comment and keeps filter and resolution changes reactive', async () => {
  render(UnresolvedOnlyExample);

  const comment = 'Please double check this paragraph.';
  expect(screen.getByText(comment)).toBeTruthy();

  await fireEvent.click(screen.getByRole('button', { name: 'Unresolved only' }));
  expect(screen.getByText(comment)).toBeTruthy();

  await fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));
  expect(screen.getByText('No unresolved comments.')).toBeTruthy();

  await fireEvent.click(screen.getByRole('button', { name: 'All comments' }));
  expect(screen.getByText(comment)).toBeTruthy();
  expect(screen.getByText('Resolved')).toBeTruthy();
});
