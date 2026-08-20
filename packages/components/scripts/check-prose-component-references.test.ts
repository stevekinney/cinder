import { describe, expect, test } from 'bun:test';

import { findProseReferenceFailures } from './check-prose-component-references.ts';

const componentNames = new Set(['container', 'page-header']);
const publicSubpaths = new Set(['icons', 'styles']);

describe('check-prose-component-references', () => {
  test('flags a genuinely dangling prose component reference', () => {
    expect(
      findProseReferenceFailures({
        source: 'Use `missing-component` instead.',
        filePath: 'fixture.md',
        componentNames,
        exampleIds: new Set(),
        publicSubpaths,
      }),
    ).toEqual([{ reference: 'missing-component', filePath: 'fixture.md' }]);
  });

  test('accepts component names and deliberately referenced example ids', () => {
    expect(
      findProseReferenceFailures({
        source: 'Compose container (see its `hero-section` example).',
        filePath: 'fixture.md',
        componentNames,
        exampleIds: new Set(['hero-section']),
        publicSubpaths,
      }),
    ).toEqual([]);
  });

  test('checks prose in generated manifest metadata and package imports', () => {
    expect(
      findProseReferenceFailures({
        source: JSON.stringify({ purpose: 'Compose `missing-component` with the page.' }),
        filePath: 'components.json',
        componentNames,
        exampleIds: new Set(),
        publicSubpaths,
      }),
    ).toEqual([{ reference: 'missing-component', filePath: 'components.json' }]);
    expect(
      findProseReferenceFailures({
        source: "import Component from '@lostgradient/cinder/missing-component';",
        filePath: 'fixture.svelte',
        componentNames,
        exampleIds: new Set(),
        publicSubpaths,
      }),
    ).toEqual([{ reference: 'missing-component', filePath: 'fixture.svelte' }]);
  });

  test('allows public Cinder subpaths that are not component directories', () => {
    expect(
      findProseReferenceFailures({
        source:
          "import '@lostgradient/cinder/styles'; import { Icon } from '@lostgradient/cinder/icons';",
        filePath: 'components.json',
        componentNames,
        exampleIds: new Set(),
        publicSubpaths,
      }),
    ).toEqual([]);
  });
});
