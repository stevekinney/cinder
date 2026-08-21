import { describe, expect, it } from 'bun:test';

import {
  provenanceComponentScope,
  provenanceShard,
  snapshotUpdateEnvironment,
  startServerArguments,
} from './update-snapshots.ts';

describe('update-snapshots helpers', () => {
  it('builds the Playwright update command before forwarded arguments', () => {
    expect(
      startServerArguments('/work/packages/testing/scripts/start-server.ts', ['--grep', 'Button']),
    ).toEqual([
      'run',
      '/work/packages/testing/scripts/start-server.ts',
      '--',
      '--update-snapshots=all',
      '--retries=0',
      '--grep',
      'Button',
    ]);
  });

  it('forces block mode and preserves scoped component environment', () => {
    const environment = snapshotUpdateEnvironment({
      CINDER_TEST_COMPONENTS: 'button',
      CINDER_VISUAL_DIFF: 'off',
    });
    expect(environment['CINDER_TEST_COMPONENTS']).toBe('button');
    expect(environment['CINDER_VISUAL_DIFF']).toBe('block');
    expect(environment['CINDER_UPDATE_SNAPSHOTS']).toBe('1');
  });

  it('records a full-matrix provenance scope when no component scope is set', () => {
    expect(provenanceComponentScope(undefined)).toBe('all');
    expect(provenanceComponentScope('')).toBe('all');
    expect(provenanceComponentScope('button')).toEqual(['button']);
  });

  it('records an explicit shard only when the update rendered one partition', () => {
    expect(provenanceShard(undefined)).toBeUndefined();
    expect(provenanceShard('')).toBeUndefined();
    expect(provenanceShard('3/8')).toBe('3/8');
    expect(provenanceShard(' 3/8 ')).toBe('3/8');
  });
});
