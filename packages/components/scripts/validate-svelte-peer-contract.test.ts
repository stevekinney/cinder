import { describe, expect, test } from 'bun:test';

import { sveltePeerContract } from './validate-svelte-peer-contract.ts';

describe('Svelte compatibility versions', () => {
  test('pins an exact upper-edge version inside the public peer range', () => {
    expect(sveltePeerContract.latest).toMatch(/^\d+\.\d+\.\d+$/u);
    expect(Bun.semver.satisfies(sveltePeerContract.latest, sveltePeerContract.peerRange)).toBe(
      true,
    );
    expect(Bun.semver.satisfies(sveltePeerContract.latest, `>=${sveltePeerContract.minimum}`)).toBe(
      true,
    );
  });
});
