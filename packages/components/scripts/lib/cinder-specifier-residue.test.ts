import { describe, expect, test } from 'bun:test';

import {
  type CommentScanState,
  lineHasCinderResidue,
  stripCommentsRespectingStrings,
} from './cinder-specifier-residue.ts';

function scan(line: string, state: CommentScanState = { inBlockComment: false }): boolean {
  return lineHasCinderResidue(line, state);
}

function strip(line: string, state: CommentScanState = { inBlockComment: false }): string {
  return stripCommentsRespectingStrings(line, state);
}

describe('stripCommentsRespectingStrings', () => {
  test('replaces // line comments with spaces to end of line', () => {
    const result = strip('const x = 1; // @cinder/commentary');
    expect(result.startsWith('const x = 1; ')).toBe(true);
    expect(result).not.toContain('@cinder/');
    // Length preserved so column math doesn't shift.
    expect(result.length).toBe('const x = 1; // @cinder/commentary'.length);
  });

  test('replaces /* ... */ block comments that open and close on the same line', () => {
    const result = strip('const x = /* @cinder/foo */ 1;');
    expect(result).not.toContain('@cinder/');
    expect(result.length).toBe('const x = /* @cinder/foo */ 1;'.length);
  });

  test('handles multiple inline block comments', () => {
    const result = strip('/* a */ const x = /* b */ 1;');
    expect(result.includes('const x =')).toBe(true);
    expect(result).not.toContain('/*');
  });

  test('marks the rest of the line as comment when /* is unclosed', () => {
    const state: CommentScanState = { inBlockComment: false };
    const result = strip('const x = 1; /* @cinder/commentary', state);
    expect(result).not.toContain('@cinder/');
    expect(state.inBlockComment).toBe(true);
  });

  test('treats /* inside a single-quoted string as data, not as a comment', () => {
    // The previous implementation stripped this as a comment and lost the
    // tail. Now the string literal is preserved verbatim and any specifier
    // outside the string remains scannable.
    const result = strip(`const x = '/* @cinder/foo */ stays';`);
    expect(result).toContain('@cinder/foo');
  });

  test('treats // inside a double-quoted string as data', () => {
    const result = strip(`const url = "https://example.com/@cinder/x";`);
    expect(result).toContain('@cinder/x');
  });

  test('treats /* inside a template literal as data', () => {
    const result = strip('const x = `/* @cinder/foo */ stays`;');
    expect(result).toContain('@cinder/foo');
  });

  test('treats /* inside a template-literal interpolation expression as code', () => {
    // Inside `${...}` we're back in code territory; comments there ARE
    // real comments. The outer template text resumes after `}`.
    const result = strip('const x = `outer ${1 /* @cinder/foo */} end`;');
    // The interpolation's comment is stripped, but the surrounding template
    // text is preserved.
    expect(result).toContain('outer');
    expect(result).toContain('end');
    expect(result).not.toContain('@cinder/');
  });

  test('handles escape sequences inside string literals', () => {
    const result = strip(`const x = 'a\\'b // @cinder/commentary';`);
    // The escaped quote keeps the string open, so the `//` inside is data.
    expect(result).toContain('@cinder/commentary');
  });
});

describe('lineHasCinderResidue', () => {
  test('flags static single-quoted specifier', () => {
    expect(scan(`import x from '@cinder/commentary';`)).toBe(true);
  });

  test('flags static double-quoted specifier', () => {
    expect(scan(`import x from "@cinder/commentary";`)).toBe(true);
  });

  test('flags backtick-quoted no-interpolation specifier', () => {
    expect(scan('await import(`@cinder/commentary`);')).toBe(true);
  });

  test('flags template-literal specifier with interpolation', () => {
    expect(scan('await import(`@cinder/${pkg}`);')).toBe(true);
  });

  test('does not flag a JSDoc continuation line with backticks (state-tracked)', () => {
    // JSDoc continuation lines (` * ...`) only appear inside an open
    // `/* ... */` span, so the caller's state will already be in
    // `inBlockComment: true` when this line is reached. The scanner returns
    // false because the entire line is inside the comment.
    const state: CommentScanState = { inBlockComment: true };
    expect(scan(' * Mention `@cinder/commentary` in prose', state)).toBe(false);
    expect(state.inBlockComment).toBe(true);
  });

  test('does not flag a `//` line comment with `@cinder/`', () => {
    expect(scan('// see `@cinder/commentary` for details')).toBe(false);
  });

  test('tracks multi-line block comments across calls and resumes after `*/`', () => {
    const state: CommentScanState = { inBlockComment: false };
    expect(scan('/* this comment continues', state)).toBe(false);
    expect(state.inBlockComment).toBe(true);
    expect(scan(' * @cinder/commentary reference', state)).toBe(false);
    expect(scan(' */', state)).toBe(false);
    expect(state.inBlockComment).toBe(false);
  });

  test('flags `/* x */ import from "@cinder/y"` — the single-line block-comment bypass case', () => {
    expect(scan(`/* ignore */ import x from '@cinder/commentary';`)).toBe(true);
  });

  test('flags `import x from "@cinder/y" /* trailing */`', () => {
    expect(scan(`import x from '@cinder/commentary' /* trailing */;`)).toBe(true);
  });

  test('does not flag a single-line block comment containing `@cinder/`', () => {
    expect(scan(`/* see @cinder/commentary */`)).toBe(false);
  });

  test('does not flag a line ending with `//` after stripping', () => {
    expect(scan(`const message = 'plain'; // @cinder/commentary is unused here`)).toBe(false);
  });

  test('tracks multi-line block comments and resumes scanning after `*/`', () => {
    const state: CommentScanState = { inBlockComment: false };
    expect(scan('/* opens here', state)).toBe(false);
    expect(state.inBlockComment).toBe(true);
    expect(scan(` closes */ import x from '@cinder/commentary';`, state)).toBe(true);
    expect(state.inBlockComment).toBe(false);
  });

  test('flags an import that follows a fake comment sequence inside a string literal', () => {
    // Bugbot regression case: the `/* @cinder/foo */` sits inside a string
    // literal, so it's data, not a comment. The real `@cinder/y` import
    // afterward must still be flagged.
    expect(scan(`const fake = '/* @cinder/foo */'; import y from '@cinder/y';`)).toBe(true);
  });

  test('flags an import that follows a fake // sequence inside a double-quoted string', () => {
    expect(scan(`const url = "http://x.com/// @cinder/foo"; import y from "@cinder/y";`)).toBe(
      true,
    );
  });

  test('flags an import that follows a fake /* sequence inside a template literal', () => {
    expect(scan('const t = `/* @cinder/foo */`; const y = `@cinder/y`;')).toBe(true);
  });

  test('does not flag `@cinder/...` references that only appear inside string literals', () => {
    // Strings that mention `@cinder/...` but aren't import specifiers must
    // not false-positive. The patterns only match QUOTED `@cinder/...`, so
    // a string literal that contains the substring without re-quoting it
    // should not trigger. The pattern matches whatever specifier-like
    // sequence appears inside the line, including strings — that's the
    // intentional shape; we trust that consumer JS doesn't print real
    // specifier-shaped strings as data outside of import contexts.
    expect(scan(`const description = 'see @cinder/commentary for details';`)).toBe(false);
  });
});
