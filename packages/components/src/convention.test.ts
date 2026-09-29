import { describe, expect, test } from 'bun:test';

import {
  collectStructuralConventionErrors,
  collectUnprefixedIconUtilityOffenders,
  getAllComponentSvelteFiles,
  getPublicComponentSvelteFiles,
} from './convention-structural-test-helpers.ts';

const publicSvelteFiles = getPublicComponentSvelteFiles();
const allComponentSvelteFiles = getAllComponentSvelteFiles();
const structuralConventionErrors = collectStructuralConventionErrors(publicSvelteFiles);
const unprefixedIconUtilityOffenders =
  collectUnprefixedIconUtilityOffenders(allComponentSvelteFiles);

describe('component conventions', () => {
  test('every public .svelte file passes structural conventions', () => {
    expect(publicSvelteFiles.length).toBeGreaterThan(0);
    if (structuralConventionErrors.length > 0) {
      throw new Error(
        `Convention violations found:\n${structuralConventionErrors.map((e) => `  • ${e}`).join('\n')}`,
      );
    }
  });
});

describe('component icon utility namespace', () => {
  test('component internals do not use unprefixed icon utility classes', () => {
    expect(allComponentSvelteFiles.length).toBeGreaterThan(0);
    expect(unprefixedIconUtilityOffenders).toEqual([]);
  });
});
