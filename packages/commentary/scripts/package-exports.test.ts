// @ts-nocheck -- migrated commentary assertions use runtime-verified fixture indexing.
import { describe, expect, test } from 'bun:test';

import {
  getBuildEntrypoints,
  getExpectedBuildOutputs,
  parsePackageExports,
} from './package-exports.js';

const packageRoot = `${import.meta.dirname}/..`;
const packageJsonPath = `${packageRoot}/package.json`;

describe('@cinder/commentary package export build contract', () => {
  test('derives Bun build entrypoints from the package export map', async () => {
    const packageJson = await Bun.file(packageJsonPath).json();
    const packageExports = parsePackageExports(packageJson);

    expect(getBuildEntrypoints(packageRoot, packageExports)).toEqual([
      `${packageRoot}/src/index.ts`,
      `${packageRoot}/src/anchor-decorations.ts`,
      `${packageRoot}/src/anchoring.ts`,
      `${packageRoot}/src/comments/index.ts`,
      `${packageRoot}/src/comments/types.ts`,
      `${packageRoot}/src/export/index.ts`,
      `${packageRoot}/src/export/types.ts`,
      `${packageRoot}/src/session/index.ts`,
      `${packageRoot}/src/session/types.ts`,
      `${packageRoot}/src/shared/anchor-types.ts`,
      `${packageRoot}/src/editor/index.ts`,
      `${packageRoot}/src/editor/component-runtime.ts`,
      `${packageRoot}/src/editor/test-utilities.ts`,
    ]);
  });

  test('derives expected JavaScript and declaration outputs from package export imports', async () => {
    const packageJson = await Bun.file(packageJsonPath).json();
    const packageExports = parsePackageExports(packageJson);

    expect(getExpectedBuildOutputs(packageRoot, packageExports)).toEqual([
      `${packageRoot}/dist/index.js`,
      `${packageRoot}/dist/index.d.ts`,
      `${packageRoot}/dist/anchor-decorations.js`,
      `${packageRoot}/dist/anchor-decorations.d.ts`,
      `${packageRoot}/dist/anchoring.js`,
      `${packageRoot}/dist/anchoring.d.ts`,
      `${packageRoot}/dist/comments/index.js`,
      `${packageRoot}/dist/comments/index.d.ts`,
      `${packageRoot}/dist/comments/types.js`,
      `${packageRoot}/dist/comments/types.d.ts`,
      `${packageRoot}/dist/export/index.js`,
      `${packageRoot}/dist/export/index.d.ts`,
      `${packageRoot}/dist/export/types.js`,
      `${packageRoot}/dist/export/types.d.ts`,
      `${packageRoot}/dist/session/index.js`,
      `${packageRoot}/dist/session/index.d.ts`,
      `${packageRoot}/dist/session/types.js`,
      `${packageRoot}/dist/session/types.d.ts`,
      `${packageRoot}/dist/shared/anchor-types.js`,
      `${packageRoot}/dist/shared/anchor-types.d.ts`,
      `${packageRoot}/dist/editor/index.js`,
      `${packageRoot}/dist/editor/index.d.ts`,
      `${packageRoot}/dist/editor/component-runtime.js`,
      `${packageRoot}/dist/editor/component-runtime.d.ts`,
      `${packageRoot}/dist/editor/test-utilities.js`,
      `${packageRoot}/dist/editor/test-utilities.d.ts`,
    ]);
  });
});
