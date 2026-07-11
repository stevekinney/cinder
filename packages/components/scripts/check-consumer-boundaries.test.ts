import { describe, expect, test } from 'bun:test';

import { findConsumerBoundaryViolations } from './check-consumer-boundaries.ts';

describe('consumer boundary guard', () => {
  test('rejects relative imports into private Cinder source', () => {
    const source = `import Button from '../../../components/src/components/button/index.ts';`;
    expect(
      findConsumerBoundaryViolations(source, 'packages/playground/src/shell-app/app.svelte'),
    ).toHaveLength(1);
  });

  test('allows the public source barrel used by the local development server', () => {
    const source = `import { Button } from '../../../components/src/index.ts';`;
    expect(
      findConsumerBoundaryViolations(source, 'packages/playground/src/shell-app/app.svelte'),
    ).toEqual([]);
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
    expect(
      findConsumerBoundaryViolations(source, 'packages\\playground\\scripts\\preload.ts'),
    ).toEqual([]);
  });

  test('rejects multiline imports and selectors', () => {
    const privateImport = `await import(\n  '../../components/src/components/button/index.ts'\n);`;
    const privateSelector = `container.querySelector(\n  '.cinder-button__icon'\n);`;
    expect(
      findConsumerBoundaryViolations(privateImport, 'packages/playground/scripts/build.ts'),
    ).toHaveLength(1);
    expect(
      findConsumerBoundaryViolations(privateSelector, 'packages/playground/src/app.test.ts'),
    ).toHaveLength(1);
  });

  test('rejects template-literal dynamic imports', () => {
    const source = 'await import(`../../components/src/components/${component}/index.ts`);';
    expect(
      findConsumerBoundaryViolations(source, 'packages/playground/scripts/build.ts'),
    ).toHaveLength(1);
  });

  test('rejects dynamic imports with bundler comments', () => {
    const source = `await import(/* @vite-ignore */ '../../components/src/components/button/index.ts');`;
    expect(
      findConsumerBoundaryViolations(source, 'packages/playground/scripts/build.ts'),
    ).toHaveLength(1);
  });

  test('rejects typed selector calls and normalizes Windows paths', () => {
    const source = `container.querySelector<HTMLButtonElement>('.cinder-button__icon');`;
    expect(
      findConsumerBoundaryViolations(source, 'packages\\playground\\src\\app.test.ts'),
    ).toHaveLength(1);
  });

  test('rejects internal Cinder classes in consumer test selector calls', () => {
    const source = `container.querySelector('.cinder-button__icon');`;
    expect(
      findConsumerBoundaryViolations(source, 'packages/playground/src/app.test.ts'),
    ).toHaveLength(1);
  });

  test('rejects class-name lookups and selector calls from script tests', () => {
    const classLookup = `container.getElementsByClassName('cinder-button__icon');`;
    const selector = `container.querySelector('.cinder-button__icon');`;
    expect(
      findConsumerBoundaryViolations(classLookup, 'packages/playground/src/app.test.ts'),
    ).toHaveLength(1);
    expect(
      findConsumerBoundaryViolations(selector, 'packages/playground/scripts/app.test.ts'),
    ).toHaveLength(1);
  });

  test('rejects internal classes after other class names or quoted attribute selectors', () => {
    const classLookup = `container.getElementsByClassName('foo cinder-button__icon');`;
    const selector = `container.querySelector('[aria-label="Save"] .cinder-button__icon');`;
    expect(
      findConsumerBoundaryViolations(classLookup, 'packages/playground/src/app.test.ts'),
    ).toHaveLength(1);
    expect(
      findConsumerBoundaryViolations(selector, 'packages/playground/src/app.test.ts'),
    ).toHaveLength(1);
  });

  test('rejects class-attribute selectors', () => {
    const source = `container.querySelector('[class~="cinder-button__icon"]');`;
    expect(
      findConsumerBoundaryViolations(source, 'packages/playground/src/app.test.ts'),
    ).toHaveLength(1);
  });

  test('rejects selector constants and interpolated internal classes', () => {
    const constant = `const icon = '.cinder-button__icon'; container.querySelector(icon);`;
    const template = 'container.querySelector(`.cinder-${component}__icon`)';
    expect(
      findConsumerBoundaryViolations(constant, 'packages/playground/src/app.test.ts'),
    ).toHaveLength(1);
    expect(
      findConsumerBoundaryViolations(template, 'packages/playground/src/app.test.ts'),
    ).toHaveLength(1);
  });

  test('normalizes relative import specifiers before enforcing the boundary', () => {
    const source = `import Button from '../../../components/../components/src/components/button/index.ts';`;
    expect(
      findConsumerBoundaryViolations(source, 'packages/playground/src/shell-app/app.ts'),
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
