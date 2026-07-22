import { describe, expect, test } from 'bun:test';

import {
  type CommentScanState,
  containsUpstreamSpecifier,
  lineHasUpstreamSpecifierResidue,
  stripCommentsRespectingStrings,
} from './cinder-specifier-residue.ts';

function scan(line: string, state: CommentScanState = { inBlockComment: false }): boolean {
  return lineHasUpstreamSpecifierResidue(line, state);
}

function strip(line: string, state: CommentScanState = { inBlockComment: false }): string {
  return stripCommentsRespectingStrings(line, state);
}

describe('stripCommentsRespectingStrings', () => {
  test('replaces // line comments with spaces to end of line', () => {
    const result = strip('const x = 1; // @lostgradient/editor');
    expect(result.startsWith('const x = 1; ')).toBe(true);
    expect(result).not.toContain('@cinder/');
    // Length preserved so column math doesn't shift.
    expect(result.length).toBe('const x = 1; // @lostgradient/editor'.length);
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
    const result = strip('const x = 1; /* @lostgradient/editor', state);
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
    const result = strip(`const x = 'a\\'b // @lostgradient/editor';`);
    // The escaped quote keeps the string open, so the `//` inside is data.
    expect(result).toContain('@lostgradient/editor');
  });
});

describe('lineHasUpstreamSpecifierResidue', () => {
  test('flags static single-quoted specifier', () => {
    expect(scan(`import x from '@lostgradient/editor';`)).toBe(true);
  });

  test('flags static double-quoted specifier', () => {
    expect(scan(`import x from "@lostgradient/editor";`)).toBe(true);
  });

  test('flags backtick-quoted no-interpolation specifier', () => {
    expect(scan('await import(`@lostgradient/editor`);')).toBe(true);
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
    expect(scan(' * Mention `@lostgradient/editor` in prose', state)).toBe(false);
    expect(state.inBlockComment).toBe(true);
  });

  test('does not flag a `//` line comment with `@cinder/`', () => {
    expect(scan('// see `@lostgradient/editor` for details')).toBe(false);
  });

  test('tracks multi-line block comments across calls and resumes after `*/`', () => {
    const state: CommentScanState = { inBlockComment: false };
    expect(scan('/* this comment continues', state)).toBe(false);
    expect(state.inBlockComment).toBe(true);
    expect(scan(' * @lostgradient/editor reference', state)).toBe(false);
    expect(scan(' */', state)).toBe(false);
    expect(state.inBlockComment).toBe(false);
  });

  test('flags `/* x */ import from "@cinder/y"` — the single-line block-comment bypass case', () => {
    expect(scan(`/* ignore */ import x from '@lostgradient/editor';`)).toBe(true);
  });

  test('flags `import x from "@cinder/y" /* trailing */`', () => {
    expect(scan(`import x from '@lostgradient/editor' /* trailing */;`)).toBe(true);
  });

  test('does not flag a single-line block comment containing `@cinder/`', () => {
    expect(scan(`/* see @lostgradient/editor */`)).toBe(false);
  });

  test('does not flag a line ending with `//` after stripping', () => {
    expect(scan(`const message = 'plain'; // @lostgradient/editor is unused here`)).toBe(false);
  });

  test('tracks multi-line block comments and resumes scanning after `*/`', () => {
    const state: CommentScanState = { inBlockComment: false };
    expect(scan('/* opens here', state)).toBe(false);
    expect(state.inBlockComment).toBe(true);
    expect(scan(` closes */ import x from '@lostgradient/editor';`, state)).toBe(true);
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
    expect(scan(`const description = 'see @lostgradient/editor for details';`)).toBe(false);
  });

  describe('upstream specifiers renamed outside the @cinder/ scope', () => {
    // `@lostgradient/markdown` is the one upstream package that no longer
    // lives under `@cinder/*` (see docs/decisions/package-boundaries.md
    // Phase 2). A residue gate hardcoded to the `@cinder/` prefix silently
    // stops catching this specifier the moment it's renamed out of scope —
    // these cases are the regression this file guards against.
    test('flags a static specifier with no subpath', () => {
      expect(scan(`import x from '@lostgradient/markdown';`)).toBe(true);
    });

    test('flags a static specifier with a subpath', () => {
      expect(scan(`import { render } from '@lostgradient/markdown/rendering';`)).toBe(true);
    });

    test('flags a backtick-quoted no-interpolation specifier', () => {
      expect(scan('await import(`@lostgradient/markdown/pipeline`);')).toBe(true);
    });

    test('flags a template-literal specifier with interpolation', () => {
      expect(scan('await import(`@lostgradient/markdown/${subpath}`);')).toBe(true);
    });

    test('does not flag it inside a `//` line comment', () => {
      expect(scan('// see `@lostgradient/markdown` for details')).toBe(false);
    });

    test('does not flag a plain string that only mentions the package name', () => {
      expect(scan(`const description = 'see @lostgradient/markdown for details';`)).toBe(false);
    });
  });
});

describe('containsUpstreamSpecifier', () => {
  test('matches any @cinder/* specifier', () => {
    expect(containsUpstreamSpecifier(`import x from '@lostgradient/editor';`)).toBe(true);
  });

  test('matches @lostgradient/markdown even though it is outside the @cinder/ scope', () => {
    expect(containsUpstreamSpecifier(`import x from '@lostgradient/markdown';`)).toBe(true);
  });

  test('does not match unrelated content', () => {
    expect(containsUpstreamSpecifier(`import x from 'svelte';`)).toBe(false);
  });
});
