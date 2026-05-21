import { describe, expect, test } from 'bun:test';

import {
  type CommentScanState,
  lineHasCinderResidue,
  stripInlineComments,
} from './cinder-specifier-residue.ts';

function scan(line: string, state: CommentScanState = { inBlockComment: false }): boolean {
  return lineHasCinderResidue(line, state);
}

describe('stripInlineComments', () => {
  test('removes // line comments to end of line', () => {
    expect(stripInlineComments('const x = 1; // @cinder/markdown')).toBe('const x = 1; ');
  });

  test('removes /* ... */ block comments that open and close on the same line', () => {
    expect(stripInlineComments('const x = /* @cinder/foo */ 1;')).toBe('const x =  1;');
  });

  test('handles multiple inline block comments', () => {
    expect(stripInlineComments('/* a */ const x = /* b */ 1;')).toBe(' const x =  1;');
  });

  test('returns text up to an unclosed /* (caller handles the rest)', () => {
    expect(stripInlineComments('const x = 1; /* @cinder/markdown')).toBe('const x = 1; ');
  });
});

describe('lineHasCinderResidue', () => {
  test('flags static single-quoted specifier', () => {
    expect(scan(`import x from '@cinder/markdown';`)).toBe(true);
  });

  test('flags static double-quoted specifier', () => {
    expect(scan(`import x from "@cinder/markdown";`)).toBe(true);
  });

  test('flags backtick-quoted no-interpolation specifier', () => {
    expect(scan('await import(`@cinder/markdown`);')).toBe(true);
  });

  test('flags template-literal specifier with interpolation', () => {
    expect(scan('await import(`@cinder/${pkg}`);')).toBe(true);
  });

  test('does not flag a JSDoc-comment line with backticks', () => {
    expect(scan(' * Mention `@cinder/markdown` in prose')).toBe(false);
  });

  test('does not flag a `//` line comment with `@cinder/`', () => {
    expect(scan('// see `@cinder/markdown` for details')).toBe(false);
  });

  test('does not flag a multi-line block comment when entering on a `/*` line', () => {
    const state: CommentScanState = { inBlockComment: false };
    expect(scan('/* this comment continues', state)).toBe(false);
    expect(state.inBlockComment).toBe(true);
    expect(scan(' * @cinder/markdown reference', state)).toBe(false);
    expect(scan(' */', state)).toBe(false);
    expect(state.inBlockComment).toBe(false);
  });

  test('flags `/* x */ import from "@cinder/y"` — the Bugbot bypass case', () => {
    // Single-line block comment followed by a real specifier on the same
    // line. The previous implementation skipped the whole line because it
    // started with `/*`; this test pins down the regression.
    expect(scan(`/* ignore */ import x from '@cinder/markdown';`)).toBe(true);
  });

  test('flags `import x from "@cinder/y" /* trailing comment */`', () => {
    expect(scan(`import x from '@cinder/markdown' /* trailing */;`)).toBe(true);
  });

  test('does not flag a single-line block comment containing `@cinder/`', () => {
    expect(scan(`/* see @cinder/markdown */`)).toBe(false);
  });

  test('does not flag a line ending with `//` after stripping', () => {
    expect(scan(`const message = 'plain'; // @cinder/markdown is unused here`)).toBe(false);
  });

  test('tracks multi-line block comments across calls and resumes scanning after `*/`', () => {
    const state: CommentScanState = { inBlockComment: false };
    expect(scan('/* opens here', state)).toBe(false);
    expect(state.inBlockComment).toBe(true);
    // Same line closes the comment and contains a specifier afterward.
    expect(scan(` closes */ import x from '@cinder/markdown';`, state)).toBe(true);
    expect(state.inBlockComment).toBe(false);
  });
});
