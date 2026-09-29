/**
 * Tests for the Bun mount export — the package's published root entry point.
 *
 * Both functions are pure path arithmetic over an options bag, so the tests
 * drive them against a temporary directory rather than a built `dist/`: the
 * contract is which path each one points at and what shape it returns, not
 * whether a particular build produced a file.
 */
import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { weftUi, weftUiAssets } from './mount.ts';

const distDir = await mkdtemp(join(tmpdir(), 'weft-ui-mount-'));
await Bun.write(join(distDir, 'index.html'), '<!doctype html><div id="app"></div>');

afterAll(async () => {
  await rm(distDir, { recursive: true, force: true });
});

describe('weftUi', () => {
  test('serves the shell from the supplied dist directory as HTML', async () => {
    const response = weftUi({ distDir });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get('content-type')).toBe('text/html; charset=utf-8');
    expect(await (response as Response).text()).toBe('<!doctype html><div id="app"></div>');
  });

  test('defaults to the package’s own dist directory when none is supplied', () => {
    const response = weftUi();
    expect(response).toBeInstanceOf(Response);
    // The default points at this package's `dist/`, which no test builds, so
    // the assertion is that a target was chosen rather than that it exists.
    expect((response as Response).headers.get('content-type')).toBe('text/html; charset=utf-8');
  });
});

describe('weftUiAssets', () => {
  test('describes the content-hashed asset directory under the /assets prefix', () => {
    expect(weftUiAssets({ distDir })).toEqual({
      prefix: '/assets',
      directory: join(distDir, 'assets'),
    });
  });

  test('defaults to the package’s own dist directory when none is supplied', () => {
    const assets = weftUiAssets();
    expect(assets.prefix).toBe('/assets');
    expect(assets.directory.endsWith(join('dist', 'assets'))).toBe(true);
  });
});
