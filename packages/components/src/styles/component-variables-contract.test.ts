/**
 * Contract test for component *.variables.json files.
 *
 * The generator (`scripts/generate-component-variables.ts`) walks each
 * component's CSS and emits every `--cinder-*` declaration it finds as a
 * "public override variable".  The contract this test encodes is:
 *
 *   1. Every listed variable follows the `--cinder-<component>-*` public
 *      naming convention (no `--_cinder-*` private/internal variables).
 *
 *   2. No variable is a bare global token (`--cinder-accent`, `--cinder-space-4`,
 *      etc.) that belongs in `:root`, not in a component's override surface.
 *
 * These invariants hold across all 135+ component directories today. Any
 * generator change or hand-edit that breaks them will be caught immediately.
 *
 * NOTE — file-upload runtime-state vars
 * -------------------------------------
 * `file-upload.variables.json` currently includes
 * `--cinder-file-upload-progress-background` and
 * `--cinder-file-upload-progress-fill`. These are declared as CSS custom
 * properties in the component's `:root`-level `.cinder-file-upload {}` rule,
 * which causes the generator to include them. However they describe the
 * progress UI whose runtime state is driven by JS (the bare
 * `--cinder-file-upload-progress` counter set via `style=`), making them
 * semantically "runtime-state" rather than "consumer theme API".
 *
 * Fixing the generator is design-gated (task 2f6e14c8). The test below is
 * written to assert the CORRECT contract; the file-upload case is marked
 * `.skip` with an explicit note so it becomes a forcing function to fix the
 * generator once the design question is resolved.
 *
 * Test files may use `any` per project conventions.
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, setDefaultTimeout, test } from 'bun:test';

const COMPONENTS_DIR = join(import.meta.dir, '..', 'components');

// This file scans every component variables manifest. Under parallel CI or
// multi-worktree local runs, Bun's default 5s test timeout can expire while the
// scan is still making progress.
setDefaultTimeout(30_000);

/**
 * Runtime-state variable names that the generator currently mis-emits as public
 * override variables. Each entry is `{ component, variable }`. The test that
 * checks for these is skipped until the generator is fixed.
 *
 * See: packages/components/scripts/generate-component-variables.ts
 */
const KNOWN_RUNTIME_STATE_LEAKS: Array<{ component: string; variable: string }> = [
  // KNOWN: file-upload progress vars are runtime-state mis-emitted as public.
  // The bare --cinder-file-upload-progress counter is set via inline style= from
  // file-upload.svelte, and the *-background/*-fill tokens describe that dynamic
  // UI. Un-skip when generate-component-variables.ts is fixed — task 2f6e14c8
  // design-gated item.
  { component: 'file-upload', variable: '--cinder-file-upload-progress-background' },
  { component: 'file-upload', variable: '--cinder-file-upload-progress-fill' },
];

interface ComponentVariables {
  componentName: string;
  variables: string[];
}

async function loadAllComponentVariables(): Promise<ComponentVariables[]> {
  const entries = await readdir(COMPONENTS_DIR, { withFileTypes: true });
  const componentDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  const results: ComponentVariables[] = [];

  for (const dirName of componentDirs) {
    // Discover the actual `*.variables.json` inside the directory rather than
    // assuming the stem equals the directory name. Some directories are
    // underscore-prefixed (e.g. `_radio/`) but ship `radio.variables.json`, so a
    // `${dirName}.variables.json` assumption would silently skip them — leaving
    // their contract unenforced. The component name is the FILE stem (`radio`),
    // which is also what the `--cinder-<name>-*` ownership prefix must match.
    const dirEntries = await readdir(join(COMPONENTS_DIR, dirName));
    const variablesFile = dirEntries.find((name) => name.endsWith('.variables.json'));
    if (variablesFile === undefined) continue;

    const componentName = variablesFile.slice(0, -'.variables.json'.length);
    const variables = (await Bun.file(
      join(COMPONENTS_DIR, dirName, variablesFile),
    ).json()) as string[];
    results.push({ componentName, variables });
  }

  return results;
}

describe('component *.variables.json contract', () => {
  // ACTIVE: no private --_cinder-* variables should appear in any variables.json.
  //
  // Private variables (prefixed `--_`) are internal implementation details;
  // they are never part of the public theming API. If the generator emits one,
  // it means either the naming convention was violated in the CSS or the regex
  // in the generator is too broad.
  test('no component variables.json contains a --_cinder-* private variable', async () => {
    const allComponents = await loadAllComponentVariables();

    // Sanity floor: we know we have 100+ component dirs with variables.json.
    expect(allComponents.length).toBeGreaterThan(100);

    const violations: string[] = [];

    for (const { componentName, variables } of allComponents) {
      for (const variable of variables) {
        if (variable.startsWith('--_')) {
          violations.push(`${componentName}: "${variable}" is a private variable (--_cinder-*)`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  // ACTIVE: every listed variable must be owned by the component (no cross-namespace leaks).
  //
  // The strict rule is a FULL-name prefix match: a component named `<name>` may
  // only declare `--cinder-<name>-*` variables (e.g. `button` → `--cinder-button-*`,
  // `kanban-board` → `--cinder-kanban-board-*`).
  //
  // A leading-segment match (e.g. allowing `kanban-board` to claim any
  // `--cinder-kanban-*`) was deliberately rejected: it would let a component claim
  // a variable that semantically belongs to a longer-named sibling sharing its
  // leading segment (e.g. `avatar` claiming `--cinder-avatar-group-*`). The full-name
  // rule attributes ownership unambiguously.
  //
  // The ONE legitimate cross-name case in the corpus is a compound parent that owns
  // the override surface for its sub-structures. `kanban-board` declares
  // `--cinder-kanban-column-*` and `--cinder-kanban-card-*` because the board element
  // is the cascade scope for column/card layout tokens. That is allowlisted explicitly
  // below — a deliberate, reviewed exception, not a loose rule that hides others.
  //
  // Variables of the form `--cinder-accent` (no component segment at all) are global
  // tokens from tokens-base.css. If they appear in a component's variables.json it
  // means the component declares a global alias or a typo in the CSS.
  //
  // Each allowlist entry is `{ component, prefixes }`: extra `--cinder-*-` prefixes
  // that component is permitted to own beyond its own `--cinder-<name>-`.
  const OWNERSHIP_ALLOWLIST: Record<string, string[]> = {
    // The kanban board is the cascade scope for its columns and cards.
    'kanban-board': ['--cinder-kanban-column-', '--cinder-kanban-card-'],
  };

  test('every variable in components variables.json is owned by the declaring component', async () => {
    const allComponents = await loadAllComponentVariables();

    const violations: string[] = [];

    for (const { componentName, variables } of allComponents) {
      const validPrefixes = [
        `--cinder-${componentName}-`,
        ...(OWNERSHIP_ALLOWLIST[componentName] ?? []),
      ];

      for (const variable of variables) {
        const isOwned = validPrefixes.some((prefix) => variable.startsWith(prefix));
        if (!isOwned) {
          violations.push(
            `${componentName}: "${variable}" does not match any expected prefix (${validPrefixes.map((p) => `"${p}*"`).join(', ')})`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  // SKIPPED — known generator regression for file-upload runtime-state variables.
  //
  // KNOWN: file-upload progress vars are runtime-state mis-emitted as public;
  // un-skip when generate-component-variables.ts is fixed — task 2f6e14c8
  // design-gated item.
  //
  // This test encodes the CORRECT contract: the runtime-state variables listed in
  // KNOWN_RUNTIME_STATE_LEAKS should NOT appear in any variables.json because they
  // are driven by JS at runtime (not by consumer CSS overrides). Once the
  // generator is fixed to exclude them, remove the `.skip` and this comment.
  test.skip('no component variables.json contains a known runtime-state variable', async () => {
    const allComponents = await loadAllComponentVariables();

    const allVariablesByComponent = new Map(
      allComponents.map(({ componentName, variables }) => [componentName, variables]),
    );

    const violations: string[] = [];

    for (const { component, variable } of KNOWN_RUNTIME_STATE_LEAKS) {
      const componentVariables = allVariablesByComponent.get(component);
      if (componentVariables === undefined) continue;

      if (componentVariables.includes(variable)) {
        violations.push(
          `${component}: runtime-state variable "${variable}" is incorrectly listed as a public override variable`,
        );
      }
    }

    expect(violations).toEqual([]);
  });
});
