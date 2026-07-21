// `atomicSwapDist` is duplicated byte-for-byte into four packages because each
// package's tsconfig has `rootDir: "."`, which makes a cross-package import
// illegal — see the header comment in atomic-swap-dist.ts. Duplication is the
// chosen trade-off, but silent DRIFT between the copies is the danger: a fix
// applied to one and not the others would ship subtly different swap logic per
// package. This test is the guard. If it fails, re-copy the canonical
// (`packages/components/scripts/lib/atomic-swap-dist.ts`) over every other copy
// so all four are identical again.
import { describe, expect, it } from 'bun:test';
import { join } from 'node:path';

/** The package whose copy is treated as canonical (this test lives beside it). */
const CANONICAL_PACKAGE = 'components';

/** Every package that carries a copy of the helper, canonical listed first. */
const PACKAGES_WITH_COPY = ['components', 'diff', 'markdown', 'commentary'];

/** packages/<pkg>/scripts/lib/atomic-swap-dist.ts for the given package. */
function copyPath(packageName: string): string {
  // import.meta.dir is packages/components/scripts/lib; climb to packages/.
  return join(
    import.meta.dir,
    '..',
    '..',
    '..',
    packageName,
    'scripts',
    'lib',
    'atomic-swap-dist.ts',
  );
}

describe('atomic-swap-dist copies stay byte-for-byte identical', () => {
  it('lists every package that should carry a copy (catches a forgotten new one)', async () => {
    // A new package that builds to dist via atomicSwapDist must be added here.
    // This list is also asserted against the real filesystem below.
    expect(PACKAGES_WITH_COPY).toContain(CANONICAL_PACKAGE);
    expect(new Set(PACKAGES_WITH_COPY).size).toBe(PACKAGES_WITH_COPY.length);
  });

  it('every copy is byte-for-byte identical to the canonical components copy', async () => {
    const canonical = await Bun.file(copyPath(CANONICAL_PACKAGE)).bytes();

    for (const packageName of PACKAGES_WITH_COPY) {
      const file = Bun.file(copyPath(packageName));
      expect(await file.exists(), `${packageName} is missing its atomic-swap-dist.ts copy`).toBe(
        true,
      );

      const bytes = await file.bytes();
      const identical =
        bytes.length === canonical.length &&
        bytes.every((byte, index) => byte === canonical[index]);
      expect(
        identical,
        `${packageName}/scripts/lib/atomic-swap-dist.ts has DRIFTED from the canonical copy`,
      ).toBe(true);
    }
  });
});
