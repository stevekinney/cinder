import { expect, test } from 'bun:test';

import { componentDirectory } from './component-directory.mjs';

test('uses the stable component directory', () => {
  expect(componentDirectory('button', 'src/components/button/button.schema.json')).toBe('button');
});

test('uses the experimental component directory', () => {
  expect(
    componentDirectory(
      'json-viewer',
      'src/components/experimental/json-viewer/json-viewer.schema.json',
    ),
  ).toBe('experimental/json-viewer');
});
