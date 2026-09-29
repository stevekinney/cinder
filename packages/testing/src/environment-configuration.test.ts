import { afterEach, describe, expect, test } from 'bun:test';
import { environmentConfiguration } from './environment-configuration.ts';

const originalValues = new Map<string, string | undefined>();

function setEnvironment(name: string, value: string | undefined): void {
  if (!originalValues.has(name)) originalValues.set(name, process.env[name]);
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

afterEach(() => {
  for (const [name, value] of originalValues) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  originalValues.clear();
});

describe('environmentConfiguration', () => {
  test('resolves the selected environment names on every call', () => {
    setEnvironment('CINDER_VISUAL_DIFF', 'report');
    expect(environmentConfiguration().cinderVisualDiff).toBe('report');

    setEnvironment('CINDER_VISUAL_DIFF', 'block');
    expect(environmentConfiguration().cinderVisualDiff).toBe('block');
  });

  test('ignores undeclared environment names that normalize to another key', () => {
    setEnvironment('CINDER_VISUAL_DIFF_EXTRA', 'block');
    setEnvironment('CINDER_VISUAL_DIFF', undefined);

    expect(environmentConfiguration().cinderVisualDiff).toBeUndefined();
  });
});

test('snapshot updates retain the exact one flag convention', () => {
  for (const value of [undefined, '', '0', 'true', '1']) {
    setEnvironment('CINDER_UPDATE_SNAPSHOTS', value);
    expect(environmentConfiguration().cinderUpdateSnapshots).toBe(value === '1');
  }
});
