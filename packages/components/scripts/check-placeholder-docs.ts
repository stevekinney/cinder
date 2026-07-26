/**
 * Guards against placeholder or stale text creeping back into component README files.
 *
 * Scans every README.md and accessibility review record under `src/components/` for known staleness markers and
 * exits non-zero if any are found. Run as part of `bun run check:placeholder-docs`
 * (and CI) so regressions fail loudly on the branch that introduced them.
 */

import { Glob } from 'bun';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const componentsRoot = resolve(scriptDirectory, '..', 'src', 'components');

/**
 * Phrases whose presence in a README indicates placeholder or stale documentation.
 * Each entry is a literal string (case-sensitive).
 */
const DESIGN_REVIEW_PHRASES: string[] = [
  'Replace this sentence',
  'This migration scaffold is incomplete',
  'opt-in highlighting',
];
const ACCESSIBILITY_REVIEW_PHRASES: string[] = [
  '_Pending',
  'Pending when this review applies.',
  '_Record',
];

type Violation = {
  filePath: string;
  lineNumber: number;
  line: string;
  phrase: string;
};

export function findPlaceholderViolations(content: string, filePath: string): Violation[] {
  const isAccessibilityRecord = filePath.endsWith('.a11y.md');
  const accessibilityApplies = /^Applies:\s*yes\b/im.test(content);
  const phrases =
    isAccessibilityRecord && !accessibilityApplies
      ? DESIGN_REVIEW_PHRASES
      : [...DESIGN_REVIEW_PHRASES, ...ACCESSIBILITY_REVIEW_PHRASES];
  const violations: Violation[] = [];
  for (const [index, line] of content.split('\n').entries()) {
    for (const phrase of phrases) {
      if (line.includes(phrase))
        violations.push({ filePath, lineNumber: index + 1, line: line.trim(), phrase });
    }
  }
  return violations;
}

async function main(): Promise<void> {
  const violations: Violation[] = [];
  const globs = [new Glob('**/README.md'), new Glob('**/*.a11y.md')];
  for (const glob of globs)
    for await (const relative of glob.scan({ cwd: componentsRoot })) {
      const filePath = join(componentsRoot, relative);
      const content = await Bun.file(filePath).text();
      violations.push(...findPlaceholderViolations(content, filePath));
    }

  if (violations.length === 0) {
    process.stdout.write('✓ No placeholder or stale phrases found in component READMEs.\n');
    process.exit(0);
  }

  process.stderr.write(
    `Found ${violations.length} placeholder/stale phrase${violations.length === 1 ? '' : 's'} in component READMEs:\n\n`,
  );

  for (const { filePath, lineNumber, line, phrase } of violations) {
    process.stderr.write(`  ${filePath}:${lineNumber}\n`);
    process.stderr.write(`    phrase : "${phrase}"\n`);
    process.stderr.write(`    line   : ${line}\n\n`);
  }

  process.stderr.write('Replace each instance with accurate documentation before merging.\n');
  process.exit(1);
}

if (import.meta.main) await main();
