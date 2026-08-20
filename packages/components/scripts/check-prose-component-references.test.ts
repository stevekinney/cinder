import { describe, expect, test } from 'bun:test';

import { findProseReferenceFailures } from './check-prose-component-references.ts';

const componentNames = new Set(['container', 'page-header']);

describe('check-prose-component-references', () => {
  test('flags a genuinely dangling prose component reference', () => {
    expect(
      findProseReferenceFailures({
        source: 'Use `missing-component` instead.',
        filePath: 'fixture.md',
        componentNames,
        exampleIds: new Set(),
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
      }),
    ).toEqual([]);
  });
});
