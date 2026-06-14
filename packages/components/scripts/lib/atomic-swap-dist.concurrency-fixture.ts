// Child-process writer for the #364 publication-contract regression test
// (atomic-swap-dist.concurrency.test.ts). It is spawned with one of two modes
// and a working root, and it deliberately HOLDS OPEN a partially-published
// state via a sentinel barrier so the parent test can probe `dist/` at exactly
// the dangerous moment — deterministically, not by timing luck.
//
//   --mode unsafe-direct   Reproduces the OLD build: `rm -rf dist`, then write
//                          the manifest into a freshly-emptied `dist/` and
//                          PAUSE. A concurrent reader now sees a partial tree
//                          (manifest present, payload files missing). This is
//                          the harness-sensitivity / negative control: the
//                          parent asserts the probe DOES report a violation.
//
//   --mode atomic-staged   Reproduces the FIX: write the full tree into a
//                          private `dist.tmp-*` staging dir, PAUSE before the
//                          swap, then promote via atomicSwapDist. While paused,
//                          the live `dist/` is untouched, so a concurrent reader
//                          never sees the partial tree. Positive control.
//
// Barrier protocol (files under <root>):
//   - writer creates `partial-ready` once the partial/staged state is in place
//   - writer then waits for the parent to create `continue` before finishing
//   - writer exits 0 on success, non-zero on error (surfaced via inherited io)
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { atomicSwapDist, stagingDirectoryName } from './atomic-swap-dist.ts';

/** Files every published `dist/` must contain. `manifest.json` lists the rest
 * so a reader can tell a complete tree from a partial one. Written LAST in the
 * safe path; written FIRST (then paused) in the unsafe path to expose the gap. */
const PAYLOAD_FILES = ['alpha.js', 'beta.js', 'gamma.js'] as const;
const MANIFEST_NAME = 'manifest.json';

/** The barrier sentinel filenames, shared with the test via the same constants. */
export const PARTIAL_READY_SENTINEL = 'partial-ready';
export const CONTINUE_SENTINEL = 'continue';

function flagValue(argv: string[], flag: string): string | undefined {
  const flagIndex = argv.indexOf(flag);
  return flagIndex === -1 ? undefined : argv[flagIndex + 1];
}

function parseArguments(argv: string[]): { mode: string; root: string } {
  const mode = flagValue(argv, '--mode');
  const root = flagValue(argv, '--root');
  if (!mode || !root) {
    throw new Error('usage: --mode <unsafe-direct|atomic-staged> --root <dir>');
  }
  return { mode, root };
}

/** The manifest content for a complete tree: the list of payload files. */
function manifestContents(): string {
  return JSON.stringify({ files: [...PAYLOAD_FILES] });
}

/** Write a complete published tree (manifest + every payload file) into `dir`. */
function writeCompleteTree(directory: string): void {
  mkdirSync(directory, { recursive: true });
  for (const file of PAYLOAD_FILES) {
    writeFileSync(join(directory, file), `// ${file} complete\n`);
  }
  // Manifest last so even a naive reader of a directly-written tree sees the
  // payload before the manifest — the manifest is the completeness marker.
  writeFileSync(join(directory, MANIFEST_NAME), manifestContents());
}

/** Block until the parent creates the `continue` sentinel, or time out. The
 * parent probes and releases promptly; the generous cap only guards a hung
 * test from leaving an orphaned child forever. Synchronous busy-wait via
 * Bun.spawnSync('sleep') keeps the child single-purpose and dependency-free. */
function waitForContinue(root: string): void {
  const continuePath = join(root, CONTINUE_SENTINEL);
  for (let attempt = 0; attempt < 600; attempt += 1) {
    if (existsSync(continuePath)) return;
    Bun.spawnSync(['sleep', '0.05']);
  }
  throw new Error('timed out waiting for the parent `continue` sentinel');
}

function signalPartialReady(root: string): void {
  writeFileSync(join(root, PARTIAL_READY_SENTINEL), '');
}

function runUnsafeDirect(root: string): void {
  const distributionDirectory = join(root, 'dist');
  // The OLD build: destroy the live tree, then write into it incrementally.
  rmSync(distributionDirectory, { recursive: true, force: true });
  mkdirSync(distributionDirectory, { recursive: true });
  // Expose the partial state: manifest present, payload files ABSENT.
  writeFileSync(join(distributionDirectory, MANIFEST_NAME), manifestContents());

  signalPartialReady(root);
  waitForContinue(root);

  // Finish writing the payload so the child exits with a complete tree.
  for (const file of PAYLOAD_FILES) {
    writeFileSync(join(distributionDirectory, file), `// ${file} complete\n`);
  }
}

function runAtomicStaged(root: string): void {
  const distributionDirectory = join(root, 'dist');
  const stagingDirectory = join(root, stagingDirectoryName());
  // The FIX: build the complete tree privately, out of the reader's sight.
  writeCompleteTree(stagingDirectory);

  // The partial/staged state is fully assembled but NOT yet published. The
  // live `dist/` (created by the parent before spawn) is still the old tree.
  signalPartialReady(root);
  waitForContinue(root);

  atomicSwapDist(stagingDirectory, distributionDirectory);
}

function main(): void {
  const { mode, root } = parseArguments(Bun.argv);
  if (mode === 'unsafe-direct') {
    runUnsafeDirect(root);
  } else if (mode === 'atomic-staged') {
    runAtomicStaged(root);
  } else {
    throw new Error(`unknown --mode: ${mode}`);
  }
}

// Only act as a child writer when spawned directly. The test file imports the
// sentinel-name constants above, and that import must NOT run the writer.
if (import.meta.main) {
  main();
}
