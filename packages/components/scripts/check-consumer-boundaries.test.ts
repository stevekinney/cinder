import { describe, expect, test } from 'bun:test';

import { findConsumerBoundaryViolations } from './check-consumer-boundaries.ts';

describe('consumer boundary guard', () => {
  test('rejects relative imports into private Cinder source', () => {
    const source = `import Button from '../../../components/src/components/button/index.ts';`;
    expect(
      findConsumerBoundaryViolations(source, 'packages/playground/src/app.svelte'),
    ).toHaveLength(1);
  });

  test('allows the public source barrel used by the local development server', () => {
    const source = `import { Button } from '../../../components/src/index.ts';`;
    expect(findConsumerBoundaryViolations(source, 'packages/playground/src/app.svelte')).toEqual(
      [],
    );
  });

  test('allows public package imports', () => {
    const source = `import Button from '@lostgradient/cinder/button';`;
    expect(findConsumerBoundaryViolations(source, 'packages/playground/src/app.svelte')).toEqual(
      [],
    );
  });

  test('allows the shared DOM harness only from tests', () => {
    const source = `import { setupHappyDom } from '../../components/src/test/happy-dom.ts';`;
    expect(findConsumerBoundaryViolations(source, 'packages/playground/src/app.test.ts')).toEqual(
      [],
    );
    expect(findConsumerBoundaryViolations(source, 'packages/playground/src/app.ts')).toHaveLength(
      1,
    );
  });

  test('rejects internal Cinder classes in consumer test selector calls', () => {
    const source = `container.querySelector('.cinder-button__icon');`;
    expect(
      findConsumerBoundaryViolations(source, 'packages/playground/src/app.test.ts'),
    ).toHaveLength(1);
  });

  test('allows semantic and public-root selectors', () => {
    const source = [
      `container.querySelector('button[aria-label="Save"]');`,
      `container.querySelector('.cinder-button');`,
    ].join('\n');
    expect(findConsumerBoundaryViolations(source, 'packages/playground/src/app.test.ts')).toEqual(
      [],
    );
  });

  test('does not police component implementation tests', () => {
    const source = `container.querySelector('.cinder-button__icon');`;
    expect(
      findConsumerBoundaryViolations(
        source,
        'packages/components/src/components/button/button.test.ts',
      ),
    ).toEqual([]);
  });
});
