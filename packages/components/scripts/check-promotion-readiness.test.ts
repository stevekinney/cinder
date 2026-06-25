/**
 * Tests for the stable-promotion gate.
 *
 * Covers:
 *   - Button (reference stable component) — must PASS
 *   - Per-check FAIL scenarios via targeted assertions on helper functions
 *   - --json output shape and exit-code contracts (via Bun.spawn)
 */

import { describe, expect, setDefaultTimeout, test } from 'bun:test';
import { existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  checkPropNames,
  hasA11yCoverage,
  hasA11yDoc,
  hasBooleanIsPrefix,
  hasBrowserGuard,
  hasHydrationTest,
  hasSubstantiveTest,
  isInteractive,
  PROP_NAME_DENYLIST,
} from './component-conventions.ts';

// Several tests spawn the promotion-check CLI as a full `bun` subprocess (schema
// regeneration + ts-morph/svelte AST parsing per run). Under the parallel
// pre-push suite those subprocesses are starved and routinely exceed bun:test's
// default 5s per-test timeout, producing load-induced flakes. Raise the ceiling
// so the spawn-based contract tests stay deterministic under load; the fast
// in-process unit tests in this file are unaffected by the larger ceiling.
setDefaultTimeout(30_000);

const SCRIPT_FILE = join(fileURLToPath(import.meta.url), '..', 'check-promotion-readiness.ts');

const COMPONENTS_DIRECTORY = join(fileURLToPath(import.meta.url), '..', '..', 'src', 'components');

function componentDirectory(name: string, experimental = false): string {
  if (experimental) return join(COMPONENTS_DIRECTORY, 'experimental', name);
  return join(COMPONENTS_DIRECTORY, name);
}

// ---------------------------------------------------------------------------
// CLI helper — spawn the script and return { stdout, stderr, exitCode }
// ---------------------------------------------------------------------------

async function runPromotionCheck(
  args: string[],
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const process = Bun.spawn(['bun', SCRIPT_FILE, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ]);

  return { stdout, stderr, exitCode };
}

// ---------------------------------------------------------------------------
// Reference component: button must PASS (exit 0)
// ---------------------------------------------------------------------------

describe('button reference component', () => {
  test('exits 0 for button', async () => {
    const { exitCode } = await runPromotionCheck(['button']);
    expect(exitCode).toBe(0);
  });

  test('--json output for button is PASS with correct shape', async () => {
    const { stdout, exitCode } = await runPromotionCheck(['button', '--json']);
    expect(exitCode).toBe(0);
    const report = JSON.parse(stdout) as {
      component: string;
      currentStatus: string;
      checks: {
        test: { status: string; detail?: string };
        a11y: { status: string; detail?: string };
        hydration: { status: string; detail?: string };
        propNames: { status: string; detail?: string };
      };
      warnings: string[];
      result: string;
    };
    expect(report.component).toBe('button');
    expect(report.result).toBe('PASS');
    expect(report.checks.test.status).toBe('pass');
    expect(report.checks.a11y.status).toBe('pass');
    expect(report.checks.hydration.status).toBe('na');
    expect(report.checks.propNames.status).toBe('pass');
    expect(Array.isArray(report.warnings)).toBe(true);
  });

  test('--json emits no text before the JSON object', async () => {
    const { stdout } = await runPromotionCheck(['button', '--json']);
    // stdout must start with the JSON object, no leading prose/diagnostics
    expect(stdout.trimStart()).toMatch(/^\{/);
  });
});

// ---------------------------------------------------------------------------
// Error handling — unknown component exits 1
// ---------------------------------------------------------------------------

test('exits 1 for unknown component', async () => {
  const { exitCode, stderr } = await runPromotionCheck(['not-a-real-component-xyzzy']);
  expect(exitCode).toBe(1);
  expect(stderr).toMatch(/not found/i);
});

test('exits 1 with no arguments', async () => {
  const { exitCode } = await runPromotionCheck([]);
  expect(exitCode).toBe(1);
});

test('--json exits 1 for unknown component with no stdout (error on stderr only)', async () => {
  const { stdout, stderr, exitCode } = await runPromotionCheck([
    'not-a-real-component-xyzzy',
    '--json',
  ]);
  expect(exitCode).toBe(1);
  expect(stdout.trim()).toBe('');
  expect(stderr).toMatch(/not found/i);
});

// ---------------------------------------------------------------------------
// Experimental component path
// ---------------------------------------------------------------------------

describe('experimental component (json-viewer)', () => {
  test('exits 0 for json-viewer (experimental, alpha)', async () => {
    const { exitCode } = await runPromotionCheck(['json-viewer']);
    expect(exitCode).toBe(0);
  });

  test('--json for json-viewer reports propNames pass (depthToSrc=3 path)', async () => {
    const { stdout, exitCode } = await runPromotionCheck(['json-viewer', '--json']);
    expect(exitCode).toBe(0);
    const report = JSON.parse(stdout) as {
      component: string;
      checks: Record<string, { status: string }>;
      result: string;
    };
    expect(report.component).toBe('json-viewer');
    expect(report.checks['propNames']?.status).toBe('pass');
    expect(report.result).toBe('PASS');
  });
});

// ---------------------------------------------------------------------------
// Unit tests: hasSubstantiveTest
// ---------------------------------------------------------------------------

describe('hasSubstantiveTest', () => {
  test('returns { pass: true } for button.test.ts (has active tests)', () => {
    const testFile = join(componentDirectory('button'), 'button.test.ts');
    expect(existsSync(testFile)).toBe(true);
    const { pass, count } = hasSubstantiveTest(testFile);
    expect(pass).toBe(true);
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('returns { pass: false, count: 0 } for a non-existent file', () => {
    const result = hasSubstantiveTest('/tmp/does-not-exist-xyzzy.test.ts');
    expect(result.pass).toBe(false);
    expect(result.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: isInteractive
// ---------------------------------------------------------------------------

describe('isInteractive', () => {
  test('returns true for action category', () => {
    expect(isInteractive({ category: 'action' })).toBe(true);
  });

  test('returns true for form category', () => {
    expect(isInteractive({ category: 'form' })).toBe(true);
  });

  test('returns true for navigation category', () => {
    expect(isInteractive({ category: 'navigation' })).toBe(true);
  });

  test('returns true for overlay category', () => {
    expect(isInteractive({ category: 'overlay' })).toBe(true);
  });

  test('returns false for feedback category', () => {
    expect(isInteractive({ category: 'feedback' })).toBe(false);
  });

  test('returns false for layout category', () => {
    expect(isInteractive({ category: 'layout' })).toBe(false);
  });

  test('returns false for data-display category', () => {
    expect(isInteractive({ category: 'data-display' })).toBe(false);
  });

  test('returns false for undefined category', () => {
    expect(isInteractive({})).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: hasA11yDoc
// ---------------------------------------------------------------------------

describe('hasA11yDoc', () => {
  test('returns true for button (has adjacent a11y doc)', () => {
    const dir = componentDirectory('button');
    expect(hasA11yDoc(dir, 'button')).toBe(true);
  });

  test('returns false for a component without an a11y doc', () => {
    // table-cell is a compose-only leaf whose accessibility contract lives on Table.
    const dir = componentDirectory('table-cell');
    expect(hasA11yDoc(dir, 'table-cell')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: hasA11yCoverage
// ---------------------------------------------------------------------------

describe('hasA11yCoverage', () => {
  test('returns false for non-existent file', () => {
    expect(hasA11yCoverage('/tmp/no-such-a11y.test.ts')).toBe(false);
  });

  test('returns true when a single test block has both a keyboard call and a role query', () => {
    const tempPath = join(tmpdir(), `a11y-coverage-pass-${Date.now()}.test.ts`);
    writeFileSync(
      tempPath,
      `
import { fireEvent } from '@testing-library/svelte';
test('keyboard and role', async () => {
  const { getByRole } = render(Component);
  const el = getByRole('button');
  await fireEvent.keyDown(el, { key: 'Enter' });
  expect(el).toBeTruthy();
});
`,
    );
    try {
      expect(hasA11yCoverage(tempPath)).toBe(true);
    } finally {
      rmSync(tempPath, { force: true });
    }
  });

  test('returns false when keyboard call and role query are in separate test blocks', () => {
    const tempPath = join(tmpdir(), `a11y-coverage-split-${Date.now()}.test.ts`);
    writeFileSync(
      tempPath,
      `
import { fireEvent } from '@testing-library/svelte';
test('keyboard only', async () => {
  await fireEvent.keyDown(document.body, { key: 'Enter' });
});
test('role only', () => {
  const el = getByRole('button');
  expect(el).toBeTruthy();
});
`,
    );
    try {
      expect(hasA11yCoverage(tempPath)).toBe(false);
    } finally {
      rmSync(tempPath, { force: true });
    }
  });

  test('returns false when only keyboard call is present (no role query)', () => {
    const tempPath = join(tmpdir(), `a11y-coverage-noRole-${Date.now()}.test.ts`);
    writeFileSync(
      tempPath,
      `
import { fireEvent } from '@testing-library/svelte';
test('keyboard only', async () => {
  await fireEvent.keyDown(document.body, { key: 'Enter' });
  expect(true).toBe(true);
});
`,
    );
    try {
      expect(hasA11yCoverage(tempPath)).toBe(false);
    } finally {
      rmSync(tempPath, { force: true });
    }
  });

  test('returns false when only role query is present (no keyboard call)', () => {
    const tempPath = join(tmpdir(), `a11y-coverage-noKeyboard-${Date.now()}.test.ts`);
    writeFileSync(
      tempPath,
      `
test('role only', () => {
  const el = getByRole('button');
  expect(el).toBeTruthy();
});
`,
    );
    try {
      expect(hasA11yCoverage(tempPath)).toBe(false);
    } finally {
      rmSync(tempPath, { force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Unit tests: hasBrowserGuard
// ---------------------------------------------------------------------------

describe('hasBrowserGuard', () => {
  test('returns true for a component with a hydrated template guard', () => {
    const tempPath = join(tmpdir(), `browser-guard-hydrated-${Date.now()}.svelte`);
    writeFileSync(
      tempPath,
      `<script lang="ts">\n  let hydrated = $state(false);\n</script>\n{#if hydrated}<div />{/if}\n`,
    );
    try {
      expect(hasBrowserGuard(tempPath)).toBe(true);
    } finally {
      rmSync(tempPath, { force: true });
    }
  });

  test('returns true for markdown-editor (imports BROWSER from esm-env)', () => {
    const sveltePath = join(componentDirectory('markdown-editor'), 'markdown-editor.svelte');
    expect(hasBrowserGuard(sveltePath)).toBe(true);
  });

  test('returns false for button (no browser guard)', () => {
    const sveltePath = join(componentDirectory('button'), 'button.svelte');
    expect(hasBrowserGuard(sveltePath)).toBe(false);
  });

  test('returns false for non-existent file', () => {
    expect(hasBrowserGuard('/tmp/no-such-file.svelte')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: checkPropNames
// ---------------------------------------------------------------------------

describe('checkPropNames', () => {
  test('passes for conventional camelCase prop names', () => {
    const schema = {
      properties: {
        variant: {},
        iconOnly: {},
        fullWidth: {},
        class: {},
        'aria-label': {},
        'data-testid': {},
      },
    };
    const { violations } = checkPropNames(schema);
    expect(violations).toHaveLength(0);
  });

  test('fails for denylist entries (all-lowercase forbidden forms)', () => {
    for (const deniedName of PROP_NAME_DENYLIST) {
      const schema = { properties: { [deniedName]: {} } };
      const { violations } = checkPropNames(schema);
      expect(violations.length).toBeGreaterThan(0);
    }
  });

  test('passes for iconOnly (the correct camelCase form, NOT in denylist)', () => {
    // icononly is denied; iconOnly (camelCase) must be allowed
    const schema = { properties: { iconOnly: {} } };
    const { violations } = checkPropNames(schema);
    expect(violations).toHaveLength(0);
  });

  test('fails for className even though it is valid camelCase (convention: class)', () => {
    // cinder components expose `class?: string`, never `className`.
    const schema = { properties: { className: {} } };
    const { violations } = checkPropNames(schema);
    expect(violations.length).toBeGreaterThan(0);
  });

  test('passes for the canonical class passthrough', () => {
    const schema = { properties: { class: {} } };
    const { violations } = checkPropNames(schema);
    expect(violations).toHaveLength(0);
  });

  test('fails for kebab-case prop names', () => {
    const schema = { properties: { 'full-width': {} } };
    const { violations } = checkPropNames(schema);
    expect(violations.length).toBeGreaterThan(0);
  });

  test('fails for PascalCase prop names', () => {
    const schema = { properties: { Variant: {} } };
    const { violations } = checkPropNames(schema);
    expect(violations.length).toBeGreaterThan(0);
  });

  test('returns warnings for is-prefix props', () => {
    const schema = { properties: { isLoading: {} } };
    const { violations, warnings } = checkPropNames(schema);
    expect(violations).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  test('returns warnings for has-prefix props', () => {
    const schema = { properties: { hasError: {} } };
    const { violations, warnings } = checkPropNames(schema);
    expect(violations).toHaveLength(0);
    expect(warnings.length).toBeGreaterThan(0);
  });

  test('passes for schema with no properties', () => {
    const { violations } = checkPropNames({});
    expect(violations).toHaveLength(0);
  });

  // Regression: case-insensitive denylist — PascalCase variants must be caught.
  // Without the lowercase comparison, `onDismiss` passes the denylist check
  // (it is valid camelCase) even though `ondismiss` is in the denylist.
  test('fails for onDismiss even though ondismiss is the denied form', () => {
    const schema = { properties: { onDismiss: {} } };
    const { violations } = checkPropNames(schema);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toMatch(/onDismiss/);
  });

  test('fails for onChange even though onchange is the denied form', () => {
    const schema = { properties: { onChange: {} } };
    const { violations } = checkPropNames(schema);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations[0]).toMatch(/onChange/);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: hasBooleanIsPrefix
// ---------------------------------------------------------------------------

describe('hasBooleanIsPrefix', () => {
  test('returns true for is-prefix props', () => {
    expect(hasBooleanIsPrefix('isLoading')).toBe(true);
    expect(hasBooleanIsPrefix('isDisabled')).toBe(true);
  });

  test('returns true for has-prefix props', () => {
    expect(hasBooleanIsPrefix('hasError')).toBe(true);
  });

  test('returns false for conventional props', () => {
    expect(hasBooleanIsPrefix('loading')).toBe(false);
    expect(hasBooleanIsPrefix('disabled')).toBe(false);
    expect(hasBooleanIsPrefix('variant')).toBe(false);
    expect(hasBooleanIsPrefix('class')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Unit tests: hasHydrationTest
// ---------------------------------------------------------------------------

describe('hasHydrationTest', () => {
  test('returns true for portal.test.ts (calls renderThenHydrate)', () => {
    const testFile = join(componentDirectory('portal'), 'portal.test.ts');
    expect(existsSync(testFile)).toBe(true);
    expect(hasHydrationTest(testFile)).toBe(true);
  });

  test('returns false for button.test.ts (no renderThenHydrate)', () => {
    const testFile = join(componentDirectory('button'), 'button.test.ts');
    expect(hasHydrationTest(testFile)).toBe(false);
  });

  test('returns false for non-existent file', () => {
    expect(hasHydrationTest('/tmp/no-such-file.test.ts')).toBe(false);
  });

  test('returns true when renderThenHydrate is inside an active test() block', () => {
    const tempPath = join(tmpdir(), `hydration-active-${Date.now()}.test.ts`);
    writeFileSync(
      tempPath,
      `import { test } from 'bun:test';\n` +
        `test('hydrates', () => { renderThenHydrate(Foo, src, {}); });\n`,
    );
    try {
      expect(hasHydrationTest(tempPath)).toBe(true);
    } finally {
      rmSync(tempPath, { force: true });
    }
  });

  test('returns false when renderThenHydrate is only inside test.skip (never runs)', () => {
    const tempPath = join(tmpdir(), `hydration-skip-${Date.now()}.test.ts`);
    writeFileSync(
      tempPath,
      `import { test } from 'bun:test';\n` +
        `test.skip('hydrates', () => { renderThenHydrate(Foo, src, {}); });\n`,
    );
    try {
      expect(hasHydrationTest(tempPath)).toBe(false);
    } finally {
      rmSync(tempPath, { force: true });
    }
  });
});

// ---------------------------------------------------------------------------
// Integration: --json shape contract (exit 1 on FAIL)
// ---------------------------------------------------------------------------

describe('--json output shape on a failing component', () => {
  test('toast-region exits 1 (hydration FAIL) with valid JSON report', async () => {
    const { stdout, exitCode } = await runPromotionCheck(['toast-region', '--json']);
    expect(exitCode).toBe(1);

    const report = JSON.parse(stdout) as {
      component: string;
      result: string;
      checks: Record<string, { status: string }>;
    };
    expect(report.result).toBe('FAIL');
    expect(report.component).toBe('toast-region');
    expect(report.checks['hydration']?.status).toBe('fail');
  });

  test('--json emits no stdout text before the JSON object on FAIL', async () => {
    const { stdout } = await runPromotionCheck(['toast-region', '--json']);
    expect(stdout.trimStart()).toMatch(/^\{/);
  });

  // KNOWN COVERAGE GAP: the schema-drift FAIL paths in runPropNamesCheck
  // (missing .schema.json, missing .types.ts, stale schema, generator throw)
  // are not directly exercised — every committed component has an in-sync
  // schema, so there is no real fixture to trigger them, and the script
  // resolves COMPONENTS_DIRECTORY relative to itself which makes a synthetic
  // out-of-tree component directory impractical to wire through the CLI. The
  // drift PASS path is covered by the button and json-viewer integration
  // tests above. The FAIL paths are simple guard clauses returning a
  // structured { status: 'fail', detail } result.
});
