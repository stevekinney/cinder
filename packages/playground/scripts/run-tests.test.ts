import { describe, expect, it } from 'bun:test';

import {
  createTestProcessPlan,
  requiresFreshProcess,
  type PlaygroundTestFile,
} from './run-tests.ts';

function testFile(path: string, source = ''): PlaygroundTestFile {
  return { path, source };
}

describe('playground test process isolation', () => {
  it.each([
    ['src/component-page.test.ts', ''],
    ['src/playground-server.test.ts', "import { handleRequest } from './playground-server.ts';"],
    ['scripts/static-export.test.ts', "import { runStaticExport } from './static-export.ts';"],
    ['src/direct-build.test.ts', 'await Bun.build(options);'],
    ['src/dynamic-server.test.ts', "const server = await import('./playground-server.ts');"],
  ])('isolates %s in a fresh process', (path, source) => {
    expect(requiresFreshProcess(testFile(path, source))).toBeTrue();
  });

  it('keeps tests without mounts or builds in the shared process', () => {
    expect(requiresFreshProcess(testFile('src/analyze.test.ts'))).toBeFalse();
  });

  it('places every state-sensitive test in its own process', () => {
    expect(
      createTestProcessPlan([
        testFile(
          'src/playground-server.test.ts',
          "import { handleRequest } from './playground-server.ts';",
        ),
        testFile('src/analyze.test.ts'),
        testFile(
          'scripts/static-export.test.ts',
          "import { runStaticExport } from './static-export.ts';",
        ),
        testFile('src/discover.test.ts'),
      ]),
    ).toEqual([
      ['src/analyze.test.ts', 'src/discover.test.ts'],
      ['scripts/static-export.test.ts'],
      ['src/playground-server.test.ts'],
    ]);
  });
});
