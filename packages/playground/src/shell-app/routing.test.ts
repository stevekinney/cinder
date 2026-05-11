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
  createPreviewMessage,
  parseComponentFromPath,
} from './routing.ts';

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
    expect(createPreviewMessage('cinder:set-theme', 'system')).toEqual({
      type: 'cinder:set-theme',
      value: 'system',
    });
  });

  it('builds a background message for each allowed value', () => {
    expect(createPreviewMessage('cinder:set-background', 'surface')).toEqual({
      type: 'cinder:set-background',
      value: 'surface',
    });
    expect(createPreviewMessage('cinder:set-background', 'inverse')).toEqual({
      type: 'cinder:set-background',
      value: 'inverse',
    });
    expect(createPreviewMessage('cinder:set-background', 'checker')).toEqual({
      type: 'cinder:set-background',
      value: 'checker',
    });
  });

  it('returns null for an unknown theme value', () => {
    // @ts-expect-error — exercising runtime validation
    expect(createPreviewMessage('cinder:set-theme', 'midnight')).toBeNull();
  });

  it('returns null for an unknown background value', () => {
    // @ts-expect-error — exercising runtime validation
    expect(createPreviewMessage('cinder:set-background', 'rainbow')).toBeNull();
  });
});
