// The #364 regression test: a deterministic publication-contract check that
// would have FAILED against the old `rm -rf dist; write incrementally` build and
// PASSES against atomicSwapDist. Two cases share one probe:
//
//   1. Negative control (unsafe-direct) — proves the probe is SENSITIVE: a child
//      that directly empties `dist/` and writes a partial tree IS caught.
//   2. Positive control (atomic-staged) — proves the FIX: while a child holds a
//      complete staging tree open, the live `dist/` is never seen partial.
//
// Without the negative control, case 2 could pass against a broken build simply
// because the probe never sampled the bad window. The sentinel barrier (see the
// fixture) holds the dangerous state open indefinitely, so neither case relies
// on timing luck — the parent orchestrates, it does not race.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  CONTINUE_SENTINEL,
  PARTIAL_READY_SENTINEL,
} from './atomic-swap-dist.concurrency-fixture.ts';

const FIXTURE = join(import.meta.dir, 'atomic-swap-dist.concurrency-fixture.ts');
const PAYLOAD_FILES = ['alpha.js', 'beta.js', 'gamma.js'];
const MANIFEST_NAME = 'manifest.json';

let testRoot: string;

beforeEach(() => {
  testRoot = mkdtempSync(join(tmpdir(), 'atomic-swap-concurrency-'));
});

afterEach(() => {
  rmSync(testRoot, { recursive: true, force: true });
});

/** The reader's view of `dist/` at one instant, from a separate process's swap.
 *
 *   - 'absent'    `dist/` does not exist (the documented rebuild ENOENT window).
 *   - 'complete'  manifest present AND every listed payload file present + read.
 *   - 'partial'   `dist/` exists but the tree is incomplete — a #364 violation.
 *
 * The ENOENT three-case handling matters: a child read can fail because the
 * WHOLE directory just vanished (allowed) versus because a sibling is missing
 * from a present directory (violation). We re-check `dist/` existence to tell
 * them apart. */
function probeDist(distributionDirectory: string): 'absent' | 'complete' | 'partial' {
  let entries: string[];
  try {
    entries = readdirSync(distributionDirectory);
  } catch (error) {
    if (isErrnoCode(error, 'ENOENT')) return 'absent';
    throw error;
  }

  if (!entries.includes(MANIFEST_NAME)) return 'partial';

  for (const file of PAYLOAD_FILES) {
    try {
      readFileSync(join(distributionDirectory, file));
    } catch (error) {
      if (isErrnoCode(error, 'ENOENT')) {
        // Either the directory vanished entirely between readdir and now (the
        // allowed swap window) or this one sibling is missing from a present
        // dist (a real partial tree). Distinguish by re-checking dist itself.
        if (!existsSync(distributionDirectory)) return 'absent';
        return 'partial';
      }
      throw error;
    }
  }
  return 'complete';
}

function isErrnoCode(error: unknown, code: string): boolean {
  return (
    error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === code
  );
}

/** Poll for the writer's `partial-ready` sentinel, capped so a hung child can't
 * wedge the suite. The barrier makes this deterministic: the child does not
 * proceed until we release it, so the partial state is present the instant the
 * sentinel appears. */
async function waitForPartialReady(root: string): Promise<void> {
  const sentinel = join(root, PARTIAL_READY_SENTINEL);
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (existsSync(sentinel)) return;
    await Bun.sleep(25);
  }
  throw new Error('child never signalled partial-ready');
}

/** Release the writer by creating the `continue` sentinel it is blocked on. */
function releaseWriter(root: string): void {
  writeFileSync(join(root, CONTINUE_SENTINEL), '');
}

/** Any `dist.tmp-*` / `dist.old-*` litter left in `root` after the child exits. */
function swapLitter(root: string): string[] {
  return readdirSync(root).filter(
    (name) => name.startsWith('dist.tmp-') || name.startsWith('dist.old-'),
  );
}

function spawnFixture(mode: string, root: string) {
  return Bun.spawn(['bun', FIXTURE, '--mode', mode, '--root', root], {
    stdout: 'inherit',
    stderr: 'inherit',
  });
}

describe('atomicSwapDist publication contract (#364 regression)', () => {
  it('negative control: a direct-write build DOES expose a partial dist (probe is sensitive)', async () => {
    const distributionDirectory = join(testRoot, 'dist');
    const child = spawnFixture('unsafe-direct', testRoot);

    await waitForPartialReady(testRoot);
    // The old build has emptied dist and written only the manifest. A reader
    // MUST be able to observe that partial tree — otherwise this test could
    // never have caught #364.
    expect(probeDist(distributionDirectory)).toBe('partial');

    releaseWriter(testRoot);
    expect(await child.exited).toBe(0);
    // After completion the tree is whole again.
    expect(probeDist(distributionDirectory)).toBe('complete');
  });

  it('positive control: atomicSwapDist NEVER exposes a partial dist', async () => {
    const distributionDirectory = join(testRoot, 'dist');
    // Seed an initial complete dist so the swap is a REBUILD (the path with the
    // vacate→install window), not a first install.
    seedCompleteDist(distributionDirectory);
    expect(probeDist(distributionDirectory)).toBe('complete');

    const child = spawnFixture('atomic-staged', testRoot);

    await waitForPartialReady(testRoot);
    // The child has a full staging tree assembled but NOT yet swapped in. The
    // live dist must still be the old COMPLETE tree — never partial.
    expect(probeDist(distributionDirectory)).toBe('complete');

    releaseWriter(testRoot);
    expect(await child.exited).toBe(0);

    // After the swap, dist is complete and no staging / vacated litter remains.
    expect(probeDist(distributionDirectory)).toBe('complete');
    expect(swapLitter(testRoot)).toHaveLength(0);
  });
});

/** Write a complete `dist/` (manifest + payload files) for the rebuild seed. */
function seedCompleteDist(distributionDirectory: string): void {
  rmSync(distributionDirectory, { recursive: true, force: true });
  mkdirSync(distributionDirectory, { recursive: true });
  for (const file of PAYLOAD_FILES) {
    writeFileSync(join(distributionDirectory, file), `// ${file} seed\n`);
  }
  writeFileSync(
    join(distributionDirectory, MANIFEST_NAME),
    JSON.stringify({ files: PAYLOAD_FILES }),
  );
}
