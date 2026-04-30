import { describe, expect, it } from 'bun:test';

import {
  getBuildEntrypoints,
  getExpectedBuildOutputs,
  parsePackageExports,
} from './package-exports.js';

const packageRoot = `${import.meta.dirname}/..`;
const packageJsonPath = `${packageRoot}/package.json`;

describe('@cinder/editor package export build contract', () => {
  it('derives Bun build entrypoints from the package export map', async () => {
    const packageJson = await Bun.file(packageJsonPath).json();
    const packageExports = parsePackageExports(packageJson);

    expect(getBuildEntrypoints(packageRoot, packageExports)).toEqual([
      `${packageRoot}/src/index.ts`,
      `${packageRoot}/src/sanitize-html.ts`,
      `${packageRoot}/src/template-placeholders.ts`,
      `${packageRoot}/src/template-render.ts`,
      `${packageRoot}/src/test-utilities.ts`,
      `${packageRoot}/src/component-runtime.ts`,
    ]);
  });

  it('derives expected JavaScript and declaration outputs from package export imports', async () => {
    const packageJson = await Bun.file(packageJsonPath).json();
    const packageExports = parsePackageExports(packageJson);

    expect(getExpectedBuildOutputs(packageRoot, packageExports)).toEqual([
      `${packageRoot}/dist/index.js`,
      `${packageRoot}/dist/index.d.ts`,
      `${packageRoot}/dist/sanitize-html.js`,
      `${packageRoot}/dist/sanitize-html.d.ts`,
      `${packageRoot}/dist/template-placeholders.js`,
      `${packageRoot}/dist/template-placeholders.d.ts`,
      `${packageRoot}/dist/template-render.js`,
      `${packageRoot}/dist/template-render.d.ts`,
      `${packageRoot}/dist/test-utilities.js`,
      `${packageRoot}/dist/test-utilities.d.ts`,
      `${packageRoot}/dist/component-runtime.js`,
      `${packageRoot}/dist/component-runtime.d.ts`,
    ]);
  });
});
