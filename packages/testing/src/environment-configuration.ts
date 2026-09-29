import { environmentalist } from '@lostgradient/environmentalist';
import type { Source } from '@lostgradient/environmentalist/types';
import { z } from 'zod';

const schema = z.object({
  browserFixtureManifest: z.string().optional().meta({ env: 'BROWSER_FIXTURE_MANIFEST' }),
  cinderTestComponents: z.string().optional().meta({ env: 'CINDER_TEST_COMPONENTS' }),
  cinderUpdateSnapshots: z
    .string()
    .optional()
    .transform((value) => value === '1')
    .meta({ env: 'CINDER_UPDATE_SNAPSHOTS' }),
  cinderVisualDiff: z.string().optional().meta({ env: 'CINDER_VISUAL_DIFF' }),
  nodeEnv: z.string().optional().meta({ env: 'NODE_ENV' }),
  testWorkerIndex: z.string().optional().meta({ env: 'TEST_WORKER_INDEX' }),
});

const environmentSource: Source = {
  id: 'corvidae-testing-process-env',
  kind: 'string',
  load: () => loadEnvironment(),
  loadSync: () => loadEnvironment(),
};

function loadEnvironment() {
  const values: Record<string, string> = {};
  const keyByEnvironmentName: Record<string, string> = {
    BROWSER_FIXTURE_MANIFEST: 'browserFixtureManifest',
    CINDER_TEST_COMPONENTS: 'cinderTestComponents',
    CINDER_UPDATE_SNAPSHOTS: 'cinderUpdateSnapshots',
    CINDER_VISUAL_DIFF: 'cinderVisualDiff',
    NODE_ENV: 'nodeEnv',
    TEST_WORKER_INDEX: 'testWorkerIndex',
  };
  for (const [name, key] of Object.entries(keyByEnvironmentName)) {
    const value = typeof process === 'undefined' ? undefined : process.env[name];
    if (value !== undefined) values[key] = value;
  }
  return Object.keys(values).length === 0 ? undefined : { values, location: 'process.env' };
}

/** Resolve the testing package's process configuration at the point of use. */
export function environmentConfiguration() {
  return environmentalist.sync({
    name: 'corvidae-testing',
    schema,
    sources: [environmentSource, 'defaults'],
    argv: [],
    coerce: false,
  });
}
