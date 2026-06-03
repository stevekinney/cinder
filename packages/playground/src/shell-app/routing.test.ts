/**
 * Unit tests for the shell-app routing helpers.
 *
 * These helpers are pure functions extracted from the Svelte SPA shell
 * specifically so they can be unit-tested without a DOM. They are the only
 * pieces of the SPA shell with deterministic input/output contracts; the
 * Svelte components themselves are integration-tested via the manual checks
 * documented in the implementation plan.
 */

import { describe, expect, it } from 'bun:test';

import {
  buildIframeSrc,
  buildShellHref,
  buildToolbarSearch,
  createPreviewMessage,
  parseComponentFromPath,
  readFocusModeFromSearch,
  readPreviewWidthFromSearch,
  readThemeFromSearch,
  readToolbarStateFromSearch,
} from './routing.ts';

const DEFAULT_TOOLBAR_STATE = {
  isFocusMode: false,
  theme: null,
  previewWidth: null,
};

describe('parseComponentFromPath', () => {
  it('returns the component name for a valid /c/:name path', () => {
    expect(parseComponentFromPath('/c/avatar')).toBe('avatar');
  });

  it('accepts kebab-case names with hyphens', () => {
    expect(parseComponentFromPath('/c/markdown-editor')).toBe('markdown-editor');
  });

  it('accepts names with digits', () => {
    expect(parseComponentFromPath('/c/h1-heading')).toBe('h1-heading');
  });

  it('returns null for paths outside /c/', () => {
    expect(parseComponentFromPath('/page/avatar')).toBeNull();
    expect(parseComponentFromPath('/styles.css')).toBeNull();
    expect(parseComponentFromPath('/')).toBeNull();
  });

  it('returns null for an empty segment', () => {
    expect(parseComponentFromPath('/c/')).toBeNull();
  });

  it('returns null for an encoded path with whitespace', () => {
    expect(parseComponentFromPath('/c/foo%20bar')).toBeNull();
  });

  it('returns null for path-traversal attempts', () => {
    expect(parseComponentFromPath('/c/..')).toBeNull();
    expect(parseComponentFromPath('/c/../etc/passwd')).toBeNull();
  });

  it('returns null for uppercase names (kebab invariant)', () => {
    expect(parseComponentFromPath('/c/Avatar')).toBeNull();
  });

  it('returns null for names starting with a hyphen', () => {
    expect(parseComponentFromPath('/c/-bad')).toBeNull();
  });

  it('ignores trailing path segments after the component', () => {
    expect(parseComponentFromPath('/c/avatar/extra')).toBeNull();
  });

  it('handles a malformed percent-encoding by returning null', () => {
    expect(parseComponentFromPath('/c/%E0%A4%A')).toBeNull();
  });
});

describe('buildShellHref', () => {
  it('returns /c/<name> for a kebab-case component', () => {
    expect(buildShellHref('avatar')).toBe('/c/avatar');
    expect(buildShellHref('markdown-editor')).toBe('/c/markdown-editor');
  });

  it('encodes special characters defensively', () => {
    expect(buildShellHref('weird name')).toBe('/c/weird%20name');
  });
});

describe('buildIframeSrc', () => {
  it('returns /page/<name> for a kebab-case component', () => {
    expect(buildIframeSrc('button')).toBe('/page/button');
    expect(buildIframeSrc('markdown-editor')).toBe('/page/markdown-editor');
  });

  it('encodes special characters defensively', () => {
    expect(buildIframeSrc('weird name')).toBe('/page/weird%20name');
  });
});

describe('createPreviewMessage', () => {
  it('builds a theme message for each allowed value', () => {
    expect(createPreviewMessage('cinder:set-theme', 'light')).toEqual({
      type: 'cinder:set-theme',
      value: 'light',
    });
    expect(createPreviewMessage('cinder:set-theme', 'dark')).toEqual({
      type: 'cinder:set-theme',
      value: 'dark',
    });
  });

  it('returns null for an unknown theme value', () => {
    // @ts-expect-error — exercising runtime validation
    expect(createPreviewMessage('cinder:set-theme', 'midnight')).toBeNull();
  });
});

describe('readFocusModeFromSearch', () => {
  it('returns false when the focus param is absent', () => {
    expect(readFocusModeFromSearch(new URLSearchParams(''))).toBe(false);
  });

  it('returns true for the canonical "1" value', () => {
    expect(readFocusModeFromSearch(new URLSearchParams('focus=1'))).toBe(true);
  });

  it('accepts a handful of truthy spellings', () => {
    expect(readFocusModeFromSearch(new URLSearchParams('focus=true'))).toBe(true);
    expect(readFocusModeFromSearch(new URLSearchParams('focus=TRUE'))).toBe(true);
    expect(readFocusModeFromSearch(new URLSearchParams('focus=yes'))).toBe(true);
    expect(readFocusModeFromSearch(new URLSearchParams('focus=on'))).toBe(true);
  });

  it('returns false for arbitrary values that are not in the truthy set', () => {
    expect(readFocusModeFromSearch(new URLSearchParams('focus=0'))).toBe(false);
    expect(readFocusModeFromSearch(new URLSearchParams('focus=false'))).toBe(false);
    expect(readFocusModeFromSearch(new URLSearchParams('focus=banana'))).toBe(false);
  });
});

describe('readThemeFromSearch', () => {
  it('returns null when the theme param is absent', () => {
    expect(readThemeFromSearch(new URLSearchParams(''))).toBeNull();
  });

  it('returns the explicit override for known values', () => {
    expect(readThemeFromSearch(new URLSearchParams('theme=light'))).toBe('light');
    expect(readThemeFromSearch(new URLSearchParams('theme=dark'))).toBe('dark');
  });

  it('returns null for the retired "system" value', () => {
    // 'system' is no longer a theme choice — absence of an override is what
    // makes the playground follow the browser, so it resolves to null.
    expect(readThemeFromSearch(new URLSearchParams('theme=system'))).toBeNull();
  });

  it('returns null for an unknown value', () => {
    expect(readThemeFromSearch(new URLSearchParams('theme=midnight'))).toBeNull();
  });
});

describe('readPreviewWidthFromSearch', () => {
  it('returns null when the width param is absent', () => {
    expect(readPreviewWidthFromSearch(new URLSearchParams(''))).toBeNull();
  });

  it('returns a numeric width within range', () => {
    expect(readPreviewWidthFromSearch(new URLSearchParams('w=375'))).toBe(375);
    expect(readPreviewWidthFromSearch(new URLSearchParams('w=1280'))).toBe(1280);
  });

  it('returns null for out-of-range values', () => {
    expect(readPreviewWidthFromSearch(new URLSearchParams('w=10'))).toBeNull();
    expect(readPreviewWidthFromSearch(new URLSearchParams('w=99999'))).toBeNull();
  });

  it('returns null for non-numeric values', () => {
    expect(readPreviewWidthFromSearch(new URLSearchParams('w=banana'))).toBeNull();
  });
});

describe('readToolbarStateFromSearch', () => {
  it('returns defaults when every param is absent', () => {
    expect(readToolbarStateFromSearch(new URLSearchParams(''))).toEqual(DEFAULT_TOOLBAR_STATE);
  });

  it('parses a fully-populated query string', () => {
    expect(readToolbarStateFromSearch(new URLSearchParams('focus=1&theme=dark&w=768'))).toEqual({
      isFocusMode: true,
      theme: 'dark',
      previewWidth: 768,
    });
  });
});

describe('buildToolbarSearch', () => {
  it('returns an empty string when every value is at its default', () => {
    expect(buildToolbarSearch(new URLSearchParams(''), DEFAULT_TOOLBAR_STATE)).toBe('');
  });

  it('omits theme when there is no override (null)', () => {
    expect(
      buildToolbarSearch(new URLSearchParams(''), {
        ...DEFAULT_TOOLBAR_STATE,
        theme: null,
      }),
    ).toBe('');
  });

  it('emits every non-default value with compact keys', () => {
    expect(
      buildToolbarSearch(new URLSearchParams(''), {
        isFocusMode: true,
        theme: 'dark',
        previewWidth: 768,
      }),
    ).toBe('?focus=1&theme=dark&w=768');
  });

  it('preserves unrelated params', () => {
    expect(
      buildToolbarSearch(new URLSearchParams('utm_source=docs'), {
        ...DEFAULT_TOOLBAR_STATE,
        theme: 'dark',
      }),
    ).toBe('?utm_source=docs&theme=dark');
  });

  it('removes a param when its value resets to the default', () => {
    expect(
      buildToolbarSearch(new URLSearchParams('focus=1&theme=dark&w=768'), {
        ...DEFAULT_TOOLBAR_STATE,
      }),
    ).toBe('');
  });

  it('does not mutate the input URLSearchParams', () => {
    const input = new URLSearchParams('focus=1');
    buildToolbarSearch(input, DEFAULT_TOOLBAR_STATE);
    expect(input.get('focus')).toBe('1');
  });
});
