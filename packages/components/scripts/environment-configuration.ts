import { environmentalist } from '@lostgradient/environmentalist';
import type { Source } from '@lostgradient/environmentalist/types';
import { z } from 'zod';

const schema = z.object({
  cinderSvgDataUriRoots: z.string().optional().meta({ env: 'CINDER_SVG_DATA_URI_ROOTS' }),
  githubStepSummary: z.string().optional().meta({ env: 'GITHUB_STEP_SUMMARY' }),
  tz: z.string().optional().meta({ env: 'TZ' }),
});

const environmentNames = {
  cinderSvgDataUriRoots: 'CINDER_SVG_DATA_URI_ROOTS',
  githubStepSummary: 'GITHUB_STEP_SUMMARY',
  tz: 'TZ',
} as const;

const environmentSource: Source = {
  id: 'cinder-process-env',
  kind: 'string',
  load: () => loadEnvironment(),
  loadSync: () => loadEnvironment(),
};

function loadEnvironment() {
  const values: Record<string, string> = {};
  for (const [key, name] of Object.entries(environmentNames)) {
    const value = typeof process === 'undefined' ? undefined : process.env[name];
    if (value !== undefined) values[key] = value;
  }
  return Object.keys(values).length === 0 ? undefined : { values, location: 'process.env' };
}

/** Resolve Cinder's script and test configuration at the point of use. */
export function environmentConfiguration() {
  return environmentalist.sync({
    name: 'corvidae-cinder',
    schema,
    sources: [environmentSource, 'defaults'],
    argv: [],
    coerce: false,
  });
}
