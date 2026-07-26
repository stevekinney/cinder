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
  '_Pending when this review applies.',
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
  const accessibilityApplies = /^-?\s*Applies:\s*yes\b/im.test(content);
  const lines = content.split('\n');
  const violations: Violation[] = [];
  const scan = (sectionLines: string[], phrases: string[], offset: number) => {
    for (const [index, line] of sectionLines.entries()) {
      for (const phrase of phrases) {
        if (phrase === '_Pending' && line.includes('Pending when this review applies.')) continue;
        if (line.includes(phrase)) {
          const lineNumber = offset + index + 1;
          if (
            !violations.some(
              (violation) => violation.lineNumber === lineNumber && violation.phrase === phrase,
            )
          )
            violations.push({ filePath, lineNumber, line: line.trim(), phrase });
        }
      }
    }
  };
  if (!isAccessibilityRecord) {
    scan(lines, [...DESIGN_REVIEW_PHRASES, ...ACCESSIBILITY_REVIEW_PHRASES], 0);
    return violations;
  }

  const designHeadings = lines.filter((line) =>
    /^##\s+Design review \(required\)\s*$/i.test(line.trim()),
  );
  const accessibilityHeadings = lines.filter((line) =>
    /^##\s+Novel interaction accessibility review\s*$/i.test(line.trim()),
  );
  const hasAccessibilityTemplate =
    designHeadings.length > 0 ||
    accessibilityHeadings.length > 0 ||
    /^-?\s*Applies:/im.test(content);
  const requiredDesignFields = [
    /^-\s*Reviewer:\s*\S/i,
    /^-\s*Review outcome:\s*\S/i,
    /^-\s*Nearest neighbours:\s*\S/i,
    /^-\s*Why this component exists:\s*\S/i,
  ];
  if (hasAccessibilityTemplate && designHeadings.length !== 1) {
    violations.push({
      filePath,
      lineNumber: 1,
      line: 'Expected exactly one design review heading.',
      phrase: 'design review heading',
    });
  } else if (hasAccessibilityTemplate) {
    const designStart = lines.findIndex((line) =>
      /^##\s+Design review \(required\)\s*$/i.test(line.trim()),
    );
    const designEnd = lines.findIndex(
      (line, index) => index > designStart && /^##\s+/i.test(line.trim()),
    );
    const designSection = lines.slice(designStart + 1, designEnd === -1 ? lines.length : designEnd);
    for (const field of requiredDesignFields) {
      if (!designSection.some((line) => field.test(line.trim()))) {
        violations.push({
          filePath,
          lineNumber: designStart + 1,
          line: 'Missing required design review field.',
          phrase: 'design review field',
        });
      }
    }
  }

  const accessibilityHeading = lines.findIndex((line) =>
    /^##\s+Novel interaction accessibility review\s*$/i.test(line.trim()),
  );
  if (hasAccessibilityTemplate && accessibilityHeadings.length !== 1) {
    violations.push({
      filePath,
      lineNumber: 1,
      line: 'Expected exactly one accessibility review heading.',
      phrase: 'accessibility heading',
    });
  }
  const accessibilitySectionEnd =
    accessibilityHeading === -1
      ? lines.length
      : lines.findIndex(
          (line, index) => index > accessibilityHeading && /^##\s+/i.test(line.trim()),
        );
  const appliesMatches = lines
    .map((line, index) => ({ line, index }))
    .filter(
      ({ line, index }) =>
        index > accessibilityHeading &&
        (accessibilitySectionEnd === -1 || index < accessibilitySectionEnd) &&
        /^-?\s*Applies:/i.test(line.trim()),
    );
  if (hasAccessibilityTemplate && appliesMatches.length !== 1) {
    violations.push({
      filePath,
      lineNumber: 1,
      line: 'Expected exactly one Applies yes/no decision.',
      phrase: 'Applies contract',
    });
  } else if (
    appliesMatches[0] &&
    !/^-?\s*Applies:\s*(yes|no)\b\s*\S.*/i.test(appliesMatches[0].line.trim())
  ) {
    violations.push({
      filePath,
      lineNumber: appliesMatches[0].index + 1,
      line: appliesMatches[0].line.trim(),
      phrase: 'Applies contract',
    });
  }
  if (accessibilityHeading === -1) {
    scan(
      lines,
      accessibilityApplies
        ? [...DESIGN_REVIEW_PHRASES, '_Pending', ...ACCESSIBILITY_REVIEW_PHRASES]
        : DESIGN_REVIEW_PHRASES,
      0,
    );
    return violations;
  }
  const designEnd = accessibilityHeading === -1 ? lines.length : accessibilityHeading;
  scan(lines.slice(0, designEnd), [...DESIGN_REVIEW_PHRASES, '_Pending'], 0);
  if (accessibilityHeading !== -1 && accessibilityApplies) {
    scan(
      lines.slice(accessibilityHeading + 1),
      ACCESSIBILITY_REVIEW_PHRASES,
      accessibilityHeading + 1,
    );
    const requiredAccessibilitySections = [
      /^###\s+Focus management\s*$/i,
      /^###\s+Keyboard matrix\s*$/i,
      /^###\s+Assistive-technology announcements\s*$/i,
    ];
    for (const heading of requiredAccessibilitySections) {
      const start = lines.findIndex(
        (line, index) => index > accessibilityHeading && heading.test(line.trim()),
      );
      const nextHeading = lines.findIndex(
        (line, index) => index > start && /^###\s+/i.test(line.trim()),
      );
      const section =
        start === -1 ? [] : lines.slice(start + 1, nextHeading === -1 ? lines.length : nextHeading);
      if (start === -1 || !section.some((line) => line.trim() !== ''))
        violations.push({
          filePath,
          lineNumber: start === -1 ? accessibilityHeading + 1 : start + 1,
          line: start === -1 ? 'Missing required accessibility section.' : lines[start]!.trim(),
          phrase: 'accessibility section',
        });
    }
  }
  // The applicability decision itself is required before section-specific
  // accessibility placeholders can be conditionally ignored.
  const appliesLine = lines.findIndex((line) => /^-?\s*Applies:\s*_Pending\b/i.test(line.trim()));
  if (appliesLine !== -1)
    violations.push({
      filePath,
      lineNumber: appliesLine + 1,
      line: lines[appliesLine]!.trim(),
      phrase: '_Pending',
    });
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
