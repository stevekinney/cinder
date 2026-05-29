/**
 * Stable-promotion gate.
 *
 * Usage:
 *   bun run components:promotion-check <component-name>
 *   bun run components:promotion-check <component-name> --json
 *
 * Runs four readiness checks for a component, then prints a per-check report.
 * Exits 0 on PASS, 1 on FAIL.
 *
 * Under --json: structured output to stdout only (one JSON object, no leading
 * text), all human-readable diagnostics go to stderr.
 */

import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { format, resolveConfig } from 'prettier';

import {
  checkPropNames,
  hasA11yCoverage,
  hasA11yDoc,
  hasBrowserGuard,
  hasHydrationTest,
  hasSubstantiveTest,
  isInteractive,
} from './component-conventions.ts';
import { extractComponentMetadata } from './generate-component-metadata.ts';
import { generateSchemaForComponent } from './generate-component-schema.ts';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const COMPONENTS_DIRECTORY = join(SCRIPT_DIRECTORY, '..', 'src', 'components');

// ---------------------------------------------------------------------------
// Schema-exempt components (no .types.ts / schema generated)
// ---------------------------------------------------------------------------
const SCHEMA_EXEMPT = new Set<string>([]);

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

type CheckStatus = 'pass' | 'fail' | 'na';

type CheckResult = {
  status: CheckStatus;
  detail?: string;
};

type JsonReport = {
  component: string;
  currentStatus: string;
  checks: {
    test: CheckResult;
    a11y: CheckResult;
    hydration: CheckResult;
    propNames: CheckResult;
  };
  warnings: string[];
  result: 'PASS' | 'FAIL';
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveComponentDirectory(componentName: string): {
  componentDirectory: string;
  isExperimental: boolean;
} {
  const regular = join(COMPONENTS_DIRECTORY, componentName);
  if (existsSync(regular)) return { componentDirectory: regular, isExperimental: false };

  const experimental = join(COMPONENTS_DIRECTORY, 'experimental', componentName);
  if (existsSync(experimental)) return { componentDirectory: experimental, isExperimental: true };

  throw new Error(
    `Component "${componentName}" not found under src/components/ or src/components/experimental/`,
  );
}

/**
 * Emit a progress line. Under --json it routes to stderr to keep the stdout
 * JSON contract clean (stdout is exactly one JSON object); in human mode it
 * writes to stdout alongside the report.
 */
function diagnostic(message: string, isJson: boolean): void {
  if (isJson) {
    process.stderr.write(message + '\n');
  } else {
    process.stdout.write(message + '\n');
  }
}

// ---------------------------------------------------------------------------
// Check 1 — Substantive test
// ---------------------------------------------------------------------------

function runTestCheck(componentName: string, componentDirectory: string): CheckResult {
  const testFilePath = join(componentDirectory, `${componentName}.test.ts`);
  const { pass } = hasSubstantiveTest(testFilePath);
  if (pass) return { status: 'pass' };
  if (!existsSync(testFilePath)) {
    return { status: 'fail', detail: `No test file found at ${componentName}.test.ts` };
  }
  return {
    status: 'fail',
    detail: `${componentName}.test.ts exists but has no active test() or it() calls`,
  };
}

// ---------------------------------------------------------------------------
// Check 2 — a11y coverage
// ---------------------------------------------------------------------------

function runA11yCheck(
  componentName: string,
  componentDirectory: string,
  isInteractiveComponent: boolean,
  isJson: boolean,
): CheckResult {
  if (!isInteractiveComponent) {
    return { status: 'na' };
  }

  // Exempted by a11y doc?
  if (hasA11yDoc(componentDirectory, componentName)) {
    diagnostic(`  a11y: doc found at ${componentName}.a11y.md`, isJson);
    return { status: 'pass' };
  }

  // Check for keyboard + ARIA tests in the primary test file.
  const testFilePath = join(componentDirectory, `${componentName}.test.ts`);
  if (hasA11yCoverage(testFilePath)) {
    return { status: 'pass' };
  }

  return {
    status: 'fail',
    detail:
      `Interactive component missing a11y coverage. ` +
      `Need: an ${componentName}.a11y.md doc, OR a single test() block with both ` +
      `a keyboard call (fireEvent.keyDown / user.keyboard) and a role/aria query ` +
      `(getByRole / toHaveAttribute with "role" or "aria-*").`,
  };
}

// ---------------------------------------------------------------------------
// Check 3 — hydration/SSR coverage
// ---------------------------------------------------------------------------

function runHydrationCheck(componentName: string, componentDirectory: string): CheckResult {
  const sveltePath = join(componentDirectory, `${componentName}.svelte`);
  if (!hasBrowserGuard(sveltePath)) {
    return { status: 'na' };
  }

  const testFilePath = join(componentDirectory, `${componentName}.test.ts`);
  const hydrateTestFilePath = join(componentDirectory, `${componentName}.hydrate.test.ts`);

  if (hasHydrationTest(testFilePath) || hasHydrationTest(hydrateTestFilePath)) {
    return { status: 'pass' };
  }

  return {
    status: 'fail',
    detail:
      `Component has a browser guard ({#if browser} or {#if hydrated}) but no hydration test. ` +
      `Need a render call from svelte/server or a renderThenHydrate call in ` +
      `${componentName}.test.ts or ${componentName}.hydrate.test.ts.`,
  };
}

// ---------------------------------------------------------------------------
// Check 4 — prop-name conventions (drift + names)
// ---------------------------------------------------------------------------

async function runPropNamesCheck(
  componentName: string,
  componentDirectory: string,
  isExperimental: boolean,
  isJson: boolean,
): Promise<{ result: CheckResult; warnings: string[] }> {
  if (SCHEMA_EXEMPT.has(componentName)) {
    diagnostic(`  prop-names: schema-exempt (skipped)`, isJson);
    return { result: { status: 'na' }, warnings: [] };
  }

  const committedSchemaPath = join(componentDirectory, `${componentName}.schema.json`);
  if (!existsSync(committedSchemaPath)) {
    return {
      result: {
        status: 'fail',
        detail: `Missing ${componentName}.schema.json — run bun run components:generate`,
      },
      warnings: [],
    };
  }

  // Drift check: regenerate the schema in memory and compare against the
  // committed file. The freshly generated schema is never written to disk —
  // the comparison is purely in-memory, so this check never mutates anything.
  let freshSchemaJson: string;
  try {
    const typesFilePath = join(componentDirectory, `${componentName}.types.ts`);
    if (!existsSync(typesFilePath)) {
      return {
        result: {
          status: 'fail',
          detail: `Missing ${componentName}.types.ts — cannot regenerate schema for drift check`,
        },
        warnings: [],
      };
    }
    const depthToSrc = isExperimental ? 3 : 2;
    const generateResult = generateSchemaForComponent({ typesFilePath, componentName, depthToSrc });
    const prettierOptions = await resolveConfig(committedSchemaPath);
    freshSchemaJson = await format(generateResult.schemaJson, {
      ...prettierOptions,
      filepath: committedSchemaPath,
    });
  } catch (error: unknown) {
    return {
      result: {
        status: 'fail',
        detail: `Schema generation failed: ${error instanceof Error ? error.message : String(error)}`,
      },
      warnings: [],
    };
  }

  const committedSchemaJson = await Bun.file(committedSchemaPath).text();
  if (freshSchemaJson.trim() !== committedSchemaJson.trim()) {
    return {
      result: {
        status: 'fail',
        detail:
          `Schema is stale — committed ${componentName}.schema.json does not match what ` +
          `components:generate would produce. Run: bun run components:generate`,
      },
      warnings: [],
    };
  }

  // Parse schema and check prop names.
  let schema: Record<string, unknown>;
  try {
    schema = parseJsonFile<Record<string, unknown>>(committedSchemaJson);
  } catch {
    return {
      result: { status: 'fail', detail: `Could not parse ${componentName}.schema.json` },
      warnings: [],
    };
  }

  const { violations, warnings } = checkPropNames(schema);

  if (violations.length > 0) {
    return {
      result: { status: 'fail', detail: `Prop-name violations: ${violations.join('; ')}` },
      warnings,
    };
  }

  return { result: { status: 'pass' }, warnings };
}

// ---------------------------------------------------------------------------
// Report rendering
// ---------------------------------------------------------------------------

function renderHumanReport(
  componentName: string,
  currentStatus: string,
  checks: JsonReport['checks'],
  warnings: string[],
  overallResult: 'PASS' | 'FAIL',
): void {
  const statusEmoji = { pass: '✓', fail: '✗', na: '–' };

  process.stdout.write(`\nPromotion readiness: ${componentName} (current: ${currentStatus})\n`);
  process.stdout.write('─'.repeat(60) + '\n');

  for (const [checkName, check] of Object.entries(checks)) {
    const symbol = statusEmoji[check.status];
    const label = checkName.padEnd(12);
    const statusLabel = check.status.toUpperCase().padEnd(4);
    process.stdout.write(`  ${symbol} ${label} ${statusLabel}`);
    if (check.detail) {
      process.stdout.write(`\n    ${check.detail}`);
    }
    process.stdout.write('\n');
  }

  if (warnings.length > 0) {
    process.stdout.write('\nWarnings:\n');
    for (const warning of warnings) {
      process.stdout.write(`  ⚠ ${warning}\n`);
    }
  }

  process.stdout.write('─'.repeat(60) + '\n');
  process.stdout.write(`Result: ${overallResult}\n\n`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const args = process.argv.slice(2);
  const isJson = args.includes('--json');
  const componentName = args.find((a) => !a.startsWith('--'));

  const unknownFlags = args.filter((a) => a.startsWith('--') && a !== '--json');
  if (unknownFlags.length > 0) {
    process.stderr.write(`Unknown flag(s): ${unknownFlags.join(', ')}\n`);
    process.stderr.write('Usage: bun run components:promotion-check <component-name> [--json]\n');
    process.exit(1);
  }

  if (!componentName) {
    process.stderr.write('Usage: bun run components:promotion-check <component-name> [--json]\n');
    process.exit(1);
  }

  try {
    // Resolve component directory.
    const { componentDirectory, isExperimental } = resolveComponentDirectory(componentName);

    // Extract metadata (needed for status + interactive detection).
    const metaResult = await extractComponentMetadata(
      componentName,
      componentDirectory,
      isExperimental,
    );
    if (!metaResult.ok) {
      process.stderr.write(`Error reading component metadata: ${metaResult.error.reason}\n`);
      process.exit(1);
    }
    const metadata = metaResult.metadata;
    const currentStatus = metadata.status;
    const isInteractiveComponent = isInteractive(metadata);

    diagnostic(
      `Checking ${componentName} (${currentStatus}, ${isInteractiveComponent ? 'interactive' : 'non-interactive'})...`,
      isJson,
    );

    // Run checks.
    const testCheck = runTestCheck(componentName, componentDirectory);
    const a11yCheck = runA11yCheck(
      componentName,
      componentDirectory,
      isInteractiveComponent,
      isJson,
    );
    const hydrationCheck = runHydrationCheck(componentName, componentDirectory);

    const { result: propNamesCheck, warnings } = await runPropNamesCheck(
      componentName,
      componentDirectory,
      isExperimental,
      isJson,
    );

    const checks: JsonReport['checks'] = {
      test: testCheck,
      a11y: a11yCheck,
      hydration: hydrationCheck,
      propNames: propNamesCheck,
    };

    const overallResult: 'PASS' | 'FAIL' = Object.values(checks).some((c) => c.status === 'fail')
      ? 'FAIL'
      : 'PASS';

    if (isJson) {
      const report: JsonReport = {
        component: componentName,
        currentStatus,
        checks,
        warnings,
        result: overallResult,
      };
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } else {
      renderHumanReport(componentName, currentStatus, checks, warnings, overallResult);
    }

    process.exit(overallResult === 'PASS' ? 0 : 1);
  } catch (error: unknown) {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  }
}
