/**
 * Visually-hidden class guard for `@lostgradient/chat`.
 *
 * Backs the CIN-505 fix: Chat marks visually-hidden content with the design
 * system's `.cinder-sr-only` utility (from `@lostgradient/cinder/styles`,
 * which every Chat consumer already imports — see `packages/chat/README.md`).
 * Chat's own source tree owns NO rule for a bare `.sr-only` class, so an
 * element carrying that class renders as ordinary visible text — exactly what
 * happened to `tool-call-group.svelte`'s and `conversation-export-actions.svelte`'s
 * `aria-live` status announcers before this fix, and what five other
 * components silently avoided only by each re-declaring their own private
 * copy of the same nine-line recipe.
 *
 * This script makes that class of defect mechanically impossible to
 * reintroduce: it scans every `.svelte` and `.css` file under `src/lib` for
 * the bare `sr-only` token used either as an applied class
 * (`class="sr-only"`) or as a CSS class selector (`.sr-only {`), and fails
 * the moment one appears. There is no baseline and no `--strict` flag — unlike
 * the raw-color/token-usage/platform-feature guards in `@lostgradient/cinder`,
 * this rule has no grandfathered debt to track: the fix removed every existing
 * site, so the correct count is always zero.
 *
 * The token match uses a boundary that treats `-` as part of the token, so it
 * does NOT flag `cinder-sr-only` (the correct class) or `cinder-sr-only-focusable`
 * (its focusable variant) — only a bare, unprefixed `sr-only`.
 *
 * stylelint has no built-in way to flag "a specific bare class name used
 * without cinder's prefix" and oxlint does not scan `.css` files at all, so a
 * scanned-source guard is the simplest durable enforcement — mirroring
 * `@lostgradient/cinder`'s `check-component-css-raw-colors.ts` and
 * `check-platform-features.ts`.
 *
 * Run via `bun run --filter=@lostgradient/chat visually-hidden:audit`; wired
 * into `validate`.
 */

import { Glob } from 'bun';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const chatRoot = resolve(scriptDirectory, '..');
const defaultSourceRoot = join(chatRoot, 'src', 'lib');

/** A single bare `sr-only` usage site. */
export type VisuallyHiddenClassFlag = {
  /** Source-relative POSIX path, e.g. `src/lib/components/chat/message/tool-call-group.svelte`. */
  filePath: string;
  /** 1-based line number where the bare token appears. */
  lineNumber: number;
  /** The matched line, trimmed, for the report. */
  line: string;
};

/** True for test/spec sources, which are never part of the authoring rule. */
export function isTestPath(relativePath: string): boolean {
  return /\.(?:test|spec)\.[cm]?tsx?$/.test(relativePath);
}

/** Normalizes a path to forward slashes so report output is OS-independent. */
export function toPosixPath(path: string): string {
  return path.replaceAll('\\', '/');
}

/**
 * Matches a bare `sr-only` token used as an applied class
 * (`class="sr-only"`, `class='... sr-only ...'`) or as a CSS class selector
 * (`.sr-only {`, `.sr-only,`, `.sr-only:focus`, `.parent .sr-only`). The
 * lookaround treats `-` as a token character on both sides, so `cinder-sr-only`
 * and `sr-only-focusable` never match — only the exact, unprefixed token.
 */
const CLASS_ATTRIBUTE_PATTERN =
  /class\s*=\s*(["'])(?:(?!\1)[\s\S])*(?<![\w-])sr-only(?![\w-])(?:(?!\1)[\s\S])*\1/g;
const CSS_SELECTOR_PATTERN = /(?<![\w-])\.sr-only(?![\w-])/g;

/** Scans one file's text for bare `sr-only` usage sites. */
export function scanSource(source: string): Array<{ lineNumber: number; line: string }> {
  const hits: Array<{ lineNumber: number; line: string }> = [];
  const lines = source.split('\n');

  for (const pattern of [CLASS_ATTRIBUTE_PATTERN, CSS_SELECTOR_PATTERN]) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(source)) !== null) {
      const lineNumber = source.slice(0, match.index).split('\n').length;
      hits.push({ lineNumber, line: (lines[lineNumber - 1] ?? '').trim() });
    }
  }

  return hits.toSorted((a, b) => a.lineNumber - b.lineNumber);
}

/** Scans every `.svelte` and `.css` file under `sourceRoot` for bare `sr-only` usage. */
export async function scan(
  sourceRoot: string = defaultSourceRoot,
): Promise<VisuallyHiddenClassFlag[]> {
  const flags: VisuallyHiddenClassFlag[] = [];
  const glob = new Glob('**/*.{css,svelte}');

  for await (const relativePath of glob.scan({ cwd: sourceRoot })) {
    if (isTestPath(relativePath)) continue;
    const filePath = `src/lib/${toPosixPath(relativePath)}`;
    const source = await Bun.file(join(sourceRoot, relativePath)).text();

    for (const hit of scanSource(source)) {
      flags.push({ filePath, lineNumber: hit.lineNumber, line: hit.line });
    }
  }

  return flags.toSorted(
    (a, b) => a.filePath.localeCompare(b.filePath) || a.lineNumber - b.lineNumber,
  );
}

async function main(): Promise<void> {
  const flags = await scan();

  if (flags.length === 0) {
    console.log('visually-hidden:audit — no bare `sr-only` usage found in packages/chat.');
    return;
  }

  console.error(
    `visually-hidden:audit — found ${flags.length} bare \`sr-only\` usage site(s).\n` +
      'Chat has no CSS rule for a bare `.sr-only` class; use `cinder-sr-only` ' +
      '(from `@lostgradient/cinder/styles`, which every Chat consumer imports) instead.\n',
  );
  for (const flag of flags) {
    console.error(`  ${flag.filePath}:${flag.lineNumber}  ${flag.line}`);
  }
  process.exit(1);
}

if (import.meta.main) {
  await main();
}
