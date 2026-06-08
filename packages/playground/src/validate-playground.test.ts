import { describe, expect, it } from 'bun:test';

import {
  classifyExampleTitle,
  readExampleTitle,
  validateRawArtifactSerialization,
} from './validate-playground.ts';

const moduleScript = (body: string): string =>
  `<script lang="ts" module>\n${body}\n</script>\n\n<script lang="ts"></script>\n`;

describe('readExampleTitle', () => {
  it('reads a single-quoted title', () => {
    expect(readExampleTitle(moduleScript(`export const title = 'Basic usage';`))).toBe(
      'Basic usage',
    );
  });

  it('reads a double-quoted title', () => {
    expect(readExampleTitle(moduleScript(`export const title = "Basic usage";`))).toBe(
      'Basic usage',
    );
  });

  it('reads a backtick (template literal) title', () => {
    expect(readExampleTitle(moduleScript('export const title = `Basic usage`;'))).toBe(
      'Basic usage',
    );
  });

  it('returns null when no exported title exists', () => {
    expect(
      readExampleTitle(moduleScript(`export const description = 'no title here';`)),
    ).toBeNull();
  });

  it('does not match a non-exported const title', () => {
    expect(readExampleTitle(moduleScript(`const title = 'local only';`))).toBeNull();
  });
});

describe('classifyExampleTitle', () => {
  it('classifies a present title as ok', () => {
    expect(classifyExampleTitle(moduleScript(`export const title = 'Real Title';`))).toBe('ok');
  });

  it('classifies a missing title export as missing', () => {
    expect(classifyExampleTitle(moduleScript(`export const description = 'x';`))).toBe('missing');
    expect(classifyExampleTitle('')).toBe('missing');
  });

  it('classifies the Untitled placeholder as untitled', () => {
    expect(classifyExampleTitle(moduleScript(`export const title = 'Untitled';`))).toBe('untitled');
    expect(classifyExampleTitle(moduleScript(`export const title = "Untitled";`))).toBe('untitled');
  });

  it('does not treat a non-exported Untitled const as the placeholder', () => {
    // No exported title at all → missing, not untitled.
    expect(classifyExampleTitle(moduleScript(`const title = 'Untitled';`))).toBe('missing');
  });
});

describe('validateRawArtifactSerialization', () => {
  it('accepts JSON-serializable artifacts', () => {
    expect(validateRawArtifactSerialization({ schema: { type: 'object' } })).toBeNull();
  });

  it('reports artifacts that throw during JSON serialization', () => {
    expect(validateRawArtifactSerialization({ count: BigInt(1) })).toContain(
      'could not be serialized as JSON',
    );
  });

  it('reports artifacts that serialize to undefined', () => {
    expect(validateRawArtifactSerialization(undefined)).toBe('artifact serialized to undefined');
  });
});
