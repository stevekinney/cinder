/**
 * Exhaustive unit tests for `humanizeComponentName`.
 *
 * Pure function, no DOM — covers acronym substitution, multi-word title
 * casing, single words, mixed acronym/word names, and degenerate inputs
 * (empty string, leading/trailing/doubled hyphens, whitespace, casing).
 */

import { describe, expect, it } from 'bun:test';

import { humanizeComponentName } from './humanize.ts';

describe('humanizeComponentName', () => {
  it('title-cases a single word', () => {
    expect(humanizeComponentName('button')).toBe('Button');
  });

  it('title-cases a multi-word kebab name', () => {
    expect(humanizeComponentName('tag-input')).toBe('Tag Input');
  });

  it('title-cases three-plus words', () => {
    expect(humanizeComponentName('side-navigation-item')).toBe('Side Navigation Item');
  });

  it('substitutes a leading acronym', () => {
    expect(humanizeComponentName('json-schema-editor')).toBe('JSON Schema Editor');
  });

  it('substitutes a trailing acronym', () => {
    expect(humanizeComponentName('copy-url')).toBe('Copy URL');
  });

  it('substitutes a standalone acronym', () => {
    expect(humanizeComponentName('css')).toBe('CSS');
  });

  describe('each acronym in the map', () => {
    const cases: ReadonlyArray<readonly [string, string]> = [
      ['json', 'JSON'],
      ['api', 'API'],
      ['css', 'CSS'],
      ['url', 'URL'],
      ['html', 'HTML'],
      ['ssr', 'SSR'],
      ['dom', 'DOM'],
    ];
    for (const [input, expected] of cases) {
      it(`renders "${input}" as "${expected}"`, () => {
        expect(humanizeComponentName(input)).toBe(expected);
      });
    }
  });

  it('substitutes multiple acronyms in one name', () => {
    expect(humanizeComponentName('html-to-json')).toBe('HTML To JSON');
  });

  it('handles acronyms embedded among words', () => {
    expect(humanizeComponentName('api-url-builder')).toBe('API URL Builder');
  });

  it('lowercases then title-cases already-uppercased input', () => {
    expect(humanizeComponentName('BUTTON')).toBe('Button');
  });

  it('normalizes mixed-case acronym tokens', () => {
    expect(humanizeComponentName('Json-Editor')).toBe('JSON Editor');
  });

  it('only matches acronyms as whole tokens, not substrings', () => {
    // "jsonish" is not the token "json", so it is plain title-cased.
    expect(humanizeComponentName('jsonish-widget')).toBe('Jsonish Widget');
  });

  it('returns an empty string for empty input', () => {
    expect(humanizeComponentName('')).toBe('');
  });

  it('drops empty segments from a leading hyphen', () => {
    expect(humanizeComponentName('-button')).toBe('Button');
  });

  it('drops empty segments from a trailing hyphen', () => {
    expect(humanizeComponentName('button-')).toBe('Button');
  });

  it('collapses doubled hyphens', () => {
    expect(humanizeComponentName('tag--input')).toBe('Tag Input');
  });

  it('trims surrounding whitespace', () => {
    expect(humanizeComponentName('  button  ')).toBe('Button');
  });

  it('returns an empty string for a name that is only hyphens', () => {
    expect(humanizeComponentName('---')).toBe('');
  });
});
