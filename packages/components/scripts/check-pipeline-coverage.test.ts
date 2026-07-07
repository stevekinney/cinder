import { describe, expect, it } from 'bun:test';

import {
  checkPipelineCoverage,
  DECLARATION_TABLE,
  extractRunStepBodies,
  loadParsedSources,
  resolveScriptChain,
  type DeclarationRow,
} from './check-pipeline-coverage.ts';

describe('resolveScriptChain', () => {
  it('resolves a script chain transitively, following bun run invocations', () => {
    const packageScripts = {
      validate: 'bun run lint && bun run subcheck',
      subcheck: 'bun run scripts/subcheck.ts',
      lint: 'oxlint',
    };

    const chain = resolveScriptChain('validate', packageScripts);

    expect(chain.has('validate')).toBe(true);
    expect(chain.has('lint')).toBe(true);
    expect(chain.has('subcheck')).toBe(true);
  });

  it('does not conflate overlapping script name prefixes', () => {
    const packageScripts = {
      test: 'bun test',
      'test:changed': 'bun run scripts/test-changed.ts',
      'test:coverage': 'bun test --coverage',
    };

    // `test` should not resolve to include `test:changed`/`test:coverage` —
    // its own body never invokes them via `bun run <name>`.
    const chain = resolveScriptChain('test', packageScripts);

    expect(chain.has('test')).toBe(true);
    expect(chain.has('test:changed')).toBe(false);
    expect(chain.has('test:coverage')).toBe(false);
  });
});

describe('extractRunStepBodies', () => {
  it('extracts only run: step bodies, excluding comments and job/step metadata', () => {
    const workflowYaml = [
      '# `check:changeset-prerelease-bumps` also runs inside `bun run validate` (release',
      'name: example',
      'on: push',
      'jobs:',
      '  guard:',
      '    name: Pre-1.0 changeset bump guard',
      '    steps:',
      '      - name: Checkout',
      '        uses: actions/checkout@v4',
      '      - name: Run guard',
      '        run: bun run check:changeset-prerelease-bumps',
      '',
    ].join('\n');

    const runText = extractRunStepBodies(workflowYaml);

    expect(runText).toContain('bun run check:changeset-prerelease-bumps');
    // The comment mentioning `bun run validate` must not leak into the
    // extracted run text — comments are not part of the parsed YAML value.
    expect(runText).not.toContain('validate');
  });

  it('returns an empty string when the workflow has no jobs', () => {
    expect(extractRunStepBodies('name: empty\non: push\n')).toBe('');
  });
});

describe('checkPipelineCoverage', () => {
  const packageScripts = {
    validate: 'bun run lint && bun run components:check',
    lint: 'oxlint',
    'components:check': 'bun run scripts/generate-component-artifacts.ts --check',
  };

  it('detects an undeclared duplicate: a command runs in a layer the table does not declare', () => {
    const table: Record<string, DeclarationRow> = {
      lint: { layers: [], reason: 'test fixture — declares no layers' },
    };
    const result = checkPipelineCoverage(table, {
      packageScripts,
      rootScripts: {},
      workflowText: { 'main-green': 'bun run lint' },
      hookText: {},
    });

    expect(result.violations).toContainEqual(
      expect.objectContaining({ command: 'lint', kind: 'undeclared', layer: 'main-green' }),
    );
  });

  it('detects a missing declared layer: the table declares a layer the command never actually runs in', () => {
    const table: Record<string, DeclarationRow> = {
      lint: { layers: ['main-green'], reason: 'test fixture — declares main-green' },
    };
    const result = checkPipelineCoverage(table, {
      packageScripts,
      rootScripts: {},
      workflowText: { 'main-green': 'bun run typecheck' },
      hookText: {},
    });

    expect(result.violations).toContainEqual(
      expect.objectContaining({ command: 'lint', kind: 'missing', layer: 'main-green' }),
    );
  });

  it('resolves transitive script chains so an indirectly-invoked command is not flagged missing', () => {
    const table: Record<string, DeclarationRow> = {
      'components:check': {
        layers: ['release'],
        reason: 'test fixture — reached only via `validate`',
      },
    };
    const result = checkPipelineCoverage(table, {
      packageScripts,
      rootScripts: {},
      workflowText: {
        'unit-tests': '',
        'browser-tests': '',
        'main-green': '',
        release: 'bun run validate',
        'changeset-guard': '',
      },
      hookText: {},
    });

    expect(result.violations).toEqual([]);
  });

  it('resolves an external-binary command (e.g. stylelint) through the ROOT script chain, not just the package chain', () => {
    const table: Record<string, DeclarationRow> = {
      stylelint: { layers: ['main-green'], reason: 'test fixture — reached via root `lint`' },
    };
    const result = checkPipelineCoverage(table, {
      packageScripts: { lint: 'oxlint' },
      rootScripts: { lint: 'bun run --filter=\'*\' lint && stylelint "packages/**"' },
      workflowText: {
        'unit-tests': '',
        'browser-tests': '',
        'main-green': 'bun run lint',
        release: '',
        'changeset-guard': '',
      },
      hookText: {},
    });

    expect(result.violations).toEqual([]);
  });

  it('flags an external-binary command as missing when the layer never reaches it through either manifest', () => {
    const table: Record<string, DeclarationRow> = {
      stylelint: { layers: ['release'], reason: 'test fixture — falsely declared for release' },
    };
    const result = checkPipelineCoverage(table, {
      packageScripts: { validate: 'bun run lint' },
      rootScripts: {},
      workflowText: {
        'unit-tests': '',
        'browser-tests': '',
        'main-green': '',
        release: 'bun run validate',
        'changeset-guard': '',
      },
      hookText: {},
    });

    expect(result.violations).toContainEqual(
      expect.objectContaining({ command: 'stylelint', kind: 'missing', layer: 'release' }),
    );
  });

  const noopWorkflowText = {
    'unit-tests': '',
    'browser-tests': '',
    'main-green': '',
    release: '',
    'changeset-guard': '',
  };

  it('flags a hook-layer mismatch as a warning, not a violation, when the hook script is present', () => {
    const table: Record<string, DeclarationRow> = {
      typecheck: { layers: ['pre-commit'], reason: 'test fixture' },
    };
    const result = checkPipelineCoverage(table, {
      packageScripts: {},
      rootScripts: {},
      workflowText: noopWorkflowText,
      hookText: { 'pre-commit': 'no matching token here' },
    });

    expect(result.violations).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes('advisory only'))).toBe(true);
  });

  it('warns (does not fail) when a hook script cannot be read', () => {
    const table: Record<string, DeclarationRow> = {
      typecheck: { layers: ['pre-commit'], reason: 'test fixture' },
    };
    const result = checkPipelineCoverage(table, {
      packageScripts: {},
      rootScripts: {},
      workflowText: noopWorkflowText,
      hookText: {},
    });

    expect(result.violations).toEqual([]);
    expect(result.warnings.some((warning) => warning.includes('could not be read'))).toBe(true);
  });

  it('fails (not warns) when a non-hook workflow file cannot be read', () => {
    const table: Record<string, DeclarationRow> = {
      lint: { layers: ['main-green'], reason: 'test fixture' },
    };
    const result = checkPipelineCoverage(table, {
      packageScripts,
      rootScripts: {},
      workflowText: {},
      hookText: {},
    });

    expect(
      result.violations.some(
        (violation) => violation.command === 'lint' && violation.layer === 'main-green',
      ),
    ).toBe(true);
  });

  it('passes on the current tree: the real declaration table matches real parsed sources', async () => {
    const sources = await loadParsedSources();
    const result = checkPipelineCoverage(DECLARATION_TABLE, sources);

    expect(result.violations).toEqual([]);
  });
});
