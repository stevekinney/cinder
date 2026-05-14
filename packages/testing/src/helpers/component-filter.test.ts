import { describe, expect, it } from 'bun:test';

import { applyComponentFilter, parseComponentFilter } from './component-filter.ts';

const knownSlugs = new Set(['accordion', 'button', 'badge']);

describe('parseComponentFilter', () => {
  it('returns null when the env var is unset', () => {
    expect(parseComponentFilter(undefined, knownSlugs)).toBe(null);
  });

  it('returns null when the env var is an empty string', () => {
    expect(parseComponentFilter('', knownSlugs)).toBe(null);
  });

  it('returns null when the env var is whitespace only', () => {
    expect(parseComponentFilter('   ', knownSlugs)).toBe(null);
  });

  it('returns null when the env var contains only separators / whitespace', () => {
    expect(parseComponentFilter(',  ,,', knownSlugs)).toBe(null);
  });

  it('parses a single slug', () => {
    const result = parseComponentFilter('accordion', knownSlugs);
    expect(result).not.toBe(null);
    expect([...result!]).toEqual(['accordion']);
  });

  it('parses multiple slugs and trims whitespace', () => {
    const result = parseComponentFilter('accordion , button , badge', knownSlugs);
    expect([...result!].toSorted()).toEqual(['accordion', 'badge', 'button']);
  });

  it('dedupes repeated slugs', () => {
    const result = parseComponentFilter('button,button,button', knownSlugs);
    expect([...result!]).toEqual(['button']);
  });

  it('throws when any slug is unknown', () => {
    expect(() => parseComponentFilter('accordion,not-a-thing', knownSlugs)).toThrow(/not-a-thing/);
  });

  it('lists all unknown slugs in the error and includes known slugs for debugging', () => {
    expect(() => parseComponentFilter('zzz,aaa,button', knownSlugs)).toThrow(/aaa, zzz/);
  });
});

describe('applyComponentFilter', () => {
  const entries = [
    { slug: 'accordion', name: 'Accordion' },
    { slug: 'badge', name: 'Badge' },
    { slug: 'button', name: 'Button' },
  ];

  it('returns the full list when filter is null', () => {
    expect(applyComponentFilter(entries, null)).toEqual(entries);
  });

  it('filters to entries whose slug is in the filter set', () => {
    const filter = new Set(['accordion', 'button']);
    expect(applyComponentFilter(entries, filter)).toEqual([
      { slug: 'accordion', name: 'Accordion' },
      { slug: 'button', name: 'Button' },
    ]);
  });

  it('returns an empty list when the filter matches nothing', () => {
    // This should not happen in production (parseComponentFilter rejects
    // unknown slugs first), but the function itself is pure and should
    // handle the case gracefully.
    expect(applyComponentFilter(entries, new Set(['nonexistent']))).toEqual([]);
  });
});
