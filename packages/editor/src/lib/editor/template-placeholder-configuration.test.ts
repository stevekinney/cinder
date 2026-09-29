/**
 * COR-526: resolving placeholder configuration, configuration diagnostics,
 * diagnostic list comparison, and Markdown-offset token diagnostics.
 */

import type { PlaceholderDefinitions, PlaceholderDiagnostic } from '@lostgradient/markdown';
import { describe, expect, it } from 'bun:test';
import {
  classifyPlaceholderValues,
  resolvePlaceholderConfiguration,
  UNCONFIGURED_PLACEHOLDERS,
} from './template-placeholder-configuration.js';
import { samePlaceholderDiagnostics } from './template-placeholder-diagnostic-comparison.js';
import { computePlaceholderDiagnostics } from './template-placeholder-diagnostics.js';

function codesAndProperties(diagnostics: readonly PlaceholderDiagnostic[]) {
  return diagnostics.map((diagnostic) => [
    diagnostic.code,
    diagnostic.location.kind === 'configuration' ? diagnostic.location.property : undefined,
  ]);
}

describe('resolvePlaceholderConfiguration', () => {
  it('turns every feature off with no configuration and reports nothing', () => {
    expect(resolvePlaceholderConfiguration(undefined)).toBe(UNCONFIGURED_PLACEHOLDERS);
    expect(resolvePlaceholderConfiguration({})).toBe(UNCONFIGURED_PLACEHOLDERS);
    expect(UNCONFIGURED_PLACEHOLDERS.issues).toEqual([]);
  });

  it('shares one catalog between completion, decoration and validation', () => {
    const resolved = resolvePlaceholderConfiguration({
      definitions: { candidates: [{ path: 'user.name' }, { path: 'account' }] },
    });

    expect(resolved.completion?.minimumQueryLength).toBe(0);
    expect(resolved.completion?.lookupCandidates).toBeUndefined();
    expect(resolved.completion?.candidates.map((candidate) => candidate.path)).toEqual([
      'account',
      'user.name',
    ]);
    expect(resolved.decoration?.candidates).toBe(resolved.completion!.candidates);
    expect(resolved.validationCandidates).toBe(resolved.completion!.candidates);
    expect(resolved.issues).toEqual([]);
  });

  it('normalizes each definitions object once, by identity', () => {
    const definitions: PlaceholderDefinitions = { candidates: [{ path: 'a' }] };
    const first = resolvePlaceholderConfiguration({ definitions });
    const second = resolvePlaceholderConfiguration({ definitions, valuesStatus: 'plain' });
    const replaced = resolvePlaceholderConfiguration({
      definitions: { candidates: [{ path: 'a' }] },
    });

    expect(second.completion!.candidates).toBe(first.completion!.candidates);
    expect(replaced.completion!.candidates).not.toBe(first.completion!.candidates);
  });

  it('treats an empty valid catalog as enabled with no allowed paths', () => {
    const resolved = resolvePlaceholderConfiguration({ definitions: { candidates: [] } });

    expect(resolved.completion?.candidates).toEqual([]);
    expect(resolved.validationCandidates).toEqual([]);
    expect(resolved.issues).toEqual([]);
  });

  it('disables completion and decoration for a catalog with issues and reports them', () => {
    const resolved = resolvePlaceholderConfiguration({
      definitions: { candidates: [{ path: 'ok' }, { path: 'not valid' }] },
    });

    expect(resolved.completion).toBeUndefined();
    expect(resolved.decoration).toBeUndefined();
    expect(resolved.validationCandidates).toBeUndefined();
    expect(resolved.issues.map((issue) => issue.code)).toEqual(['invalid_path_format']);
  });

  it('reports only the conflict (plus values issues) when both paths are configured', () => {
    const catalog = { candidates: [{ path: 'not valid' }] };
    const conflict = resolvePlaceholderConfiguration({
      definitions: catalog,
      completion: { candidates: [] },
    });
    const conflictWithValues = resolvePlaceholderConfiguration({
      definitions: catalog,
      decoration: { candidates: [] },
      valuesStatus: 'invalid',
    });

    expect(conflict.completion).toBeUndefined();
    expect(conflict.decoration).toBeUndefined();
    expect(conflict.validationCandidates).toBeUndefined();
    expect(codesAndProperties(conflict.issues)).toEqual([
      ['conflicting_configuration', 'placeholderDefinitions'],
    ]);
    expect(codesAndProperties(conflictWithValues.issues)).toEqual([
      ['conflicting_configuration', 'placeholderDefinitions'],
      ['invalid_values', 'placeholderValues'],
    ]);
  });

  it('reports values supplied without definitions', () => {
    expect(
      codesAndProperties(resolvePlaceholderConfiguration({ valuesStatus: 'plain' }).issues),
    ).toEqual([['invalid_definitions', 'placeholderDefinitions']]);
    expect(
      codesAndProperties(resolvePlaceholderConfiguration({ valuesStatus: 'invalid' }).issues),
    ).toEqual([
      ['invalid_definitions', 'placeholderDefinitions'],
      ['invalid_values', 'placeholderValues'],
    ]);
    expect(
      codesAndProperties(
        resolvePlaceholderConfiguration({ completion: { candidates: [] }, valuesStatus: 'plain' })
          .issues,
      ),
    ).toEqual([['invalid_definitions', 'placeholderDefinitions']]);
  });

  it('keeps low-level behavior: defaults, and token validation only with decoration', () => {
    const lookupCandidates = async () => [];
    const completionOnly = resolvePlaceholderConfiguration({
      completion: { candidates: [{ path: 'a' }], lookupCandidates },
    });
    const decorated = resolvePlaceholderConfiguration({
      decoration: { candidates: [{ path: 'b' }], invalidClassName: 'bad' },
    });

    expect(completionOnly.completion?.minimumQueryLength).toBe(1);
    expect(completionOnly.completion?.lookupDebounceMs).toBe(150);
    expect(completionOnly.completion?.lookupCandidates).toBe(lookupCandidates);
    expect(completionOnly.decoration).toBeUndefined();
    expect(completionOnly.validationCandidates).toBeUndefined();
    expect(decorated.decoration?.invalidClassName).toBe('bad');
    expect(decorated.validationCandidates?.map((candidate) => candidate.path)).toEqual(['b']);
  });
});

describe('classifyPlaceholderValues', () => {
  it('accepts only plain objects', () => {
    class Values {
      readonly name = 'Ada';
    }
    expect(classifyPlaceholderValues(undefined)).toBe('absent');
    expect(classifyPlaceholderValues({})).toBe('plain');
    expect(classifyPlaceholderValues(Object.create(null))).toBe('plain');
    expect(classifyPlaceholderValues(null)).toBe('invalid');
    expect(classifyPlaceholderValues([])).toBe('invalid');
    expect(classifyPlaceholderValues('text')).toBe('invalid');
    expect(classifyPlaceholderValues(new Values())).toBe('invalid');
  });
});

describe('samePlaceholderDiagnostics', () => {
  const token = (
    startOffset: number,
    code: PlaceholderDiagnostic['code'],
  ): PlaceholderDiagnostic => ({
    code,
    message: code,
    location: { kind: 'token', startOffset, endOffset: startOffset + 4 },
  });
  it('compares lists by code, path, location and message', () => {
    const list = [token(1, 'unknown_placeholder')];

    expect(samePlaceholderDiagnostics(list, [token(1, 'unknown_placeholder')])).toBe(true);
    expect(samePlaceholderDiagnostics(list, [token(2, 'unknown_placeholder')])).toBe(false);
    expect(samePlaceholderDiagnostics(list, [])).toBe(false);
  });
});

describe('computePlaceholderDiagnostics', () => {
  it('reports token diagnostics with offsets into the Markdown value', () => {
    const markdown = 'Hi {{nope}} and `{{code}}` {{ok}}';
    const resolved = resolvePlaceholderConfiguration({
      definitions: { candidates: [{ path: 'ok' }] },
    });

    const diagnostics = computePlaceholderDiagnostics(resolved, markdown);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.code).toBe('unknown_placeholder');
    expect(diagnostics[0]?.location).toEqual({ kind: 'token', startOffset: 3, endOffset: 11 });
    expect(markdown.slice(3, 11)).toBe('{{nope}}');
  });

  it('scans nothing without validation and keeps configuration issues first', () => {
    expect(computePlaceholderDiagnostics(UNCONFIGURED_PLACEHOLDERS, '{{nope}} {{')).toEqual([]);
    expect(
      computePlaceholderDiagnostics(
        resolvePlaceholderConfiguration({ completion: { candidates: [] } }),
        '{{nope}}',
      ),
    ).toEqual([]);

    const withValuesIssue = computePlaceholderDiagnostics(
      resolvePlaceholderConfiguration({ decoration: { candidates: [] }, valuesStatus: 'plain' }),
      '{{nope}}',
    );
    expect(withValuesIssue.map((diagnostic) => diagnostic.code)).toEqual([
      'invalid_definitions',
      'unknown_placeholder',
    ]);
  });
});
