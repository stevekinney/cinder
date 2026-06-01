import { describe, expect, it } from 'bun:test';

import {
  extractPorcelainPath,
  hasMeaningfulSnapshotChanges,
  isMeaningfulSnapshotPath,
} from './snapshot-change-detection.ts';

describe('snapshot change detection', () => {
  it('detects first-time untracked PNG baselines', () => {
    expect(
      hasMeaningfulSnapshotChanges(
        '?? packages/testing/snapshots/button/light-desktop-default.png\n',
      ),
    ).toBe(true);
  });

  it('detects provenance-only changes', () => {
    expect(hasMeaningfulSnapshotChanges(' M packages/testing/snapshots/provenance.json\n')).toBe(
      true,
    );
  });

  it('detects modified nested PNG baselines', () => {
    expect(
      hasMeaningfulSnapshotChanges(
        ' M packages/testing/snapshots/button/dark-mobile-default.png\n',
      ),
    ).toBe(true);
  });

  it('detects renamed PNG baselines when either path is under snapshots', () => {
    expect(
      hasMeaningfulSnapshotChanges(
        'R  packages/testing/snapshots/button/old.png -> packages/testing/snapshots/button/new.png\n',
      ),
    ).toBe(true);
  });

  it('ignores non-PNG files under the snapshot directory', () => {
    expect(isMeaningfulSnapshotPath('packages/testing/snapshots/button/readme.txt')).toBe(false);
  });

  it('extracts both sides of git rename porcelain output', () => {
    expect(
      extractPorcelainPath(
        'R  packages/testing/snapshots/button/old.png -> packages/testing/snapshots/button/new.png',
      ),
    ).toEqual([
      'packages/testing/snapshots/button/old.png',
      'packages/testing/snapshots/button/new.png',
    ]);
  });
});
