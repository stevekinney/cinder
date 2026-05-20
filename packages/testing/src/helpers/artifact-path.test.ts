import { describe, expect, it } from 'bun:test';
import { axeJsonPath, screenshotPath, snapshotPath, type ArtifactKey } from './artifact-path.ts';

const BASE_KEY: ArtifactKey = {
  slug: 'button',
  theme: 'light',
  viewport: 'desktop',
  fixture: 'default',
};

// ---------------------------------------------------------------------------
// screenshotPath
// ---------------------------------------------------------------------------

describe('screenshotPath', () => {
  it('includes slug, theme, viewport, and fixture in the path', () => {
    const path = screenshotPath(BASE_KEY);
    expect(path).toContain('screenshots');
    expect(path).toContain('button');
    expect(path).toContain('light-desktop-default.png');
  });

  it('places the file inside a slug-named subdirectory', () => {
    const path = screenshotPath(BASE_KEY);
    // Should end with screenshots/button/light-desktop-default.png
    expect(path).toMatch(/screenshots[/\\]button[/\\]light-desktop-default\.png$/);
  });

  it('uses a different filename for a non-default fixture', () => {
    const key: ArtifactKey = { ...BASE_KEY, fixture: 'open' };
    const path = screenshotPath(key);
    expect(path).toContain('light-desktop-open.png');
    expect(path).not.toContain('default');
  });

  it('varies by theme', () => {
    const lightPath = screenshotPath({ ...BASE_KEY, theme: 'light' });
    const darkPath = screenshotPath({ ...BASE_KEY, theme: 'dark' });
    expect(lightPath).not.toBe(darkPath);
    expect(darkPath).toContain('dark-desktop-default.png');
  });

  it('varies by viewport', () => {
    const desktopPath = screenshotPath({ ...BASE_KEY, viewport: 'desktop' });
    const mobilePath = screenshotPath({ ...BASE_KEY, viewport: 'mobile' });
    expect(desktopPath).not.toBe(mobilePath);
    expect(mobilePath).toContain('light-mobile-default.png');
  });
});

// ---------------------------------------------------------------------------
// snapshotPath
// ---------------------------------------------------------------------------

describe('snapshotPath', () => {
  it('includes snapshots directory (not screenshots)', () => {
    const path = snapshotPath(BASE_KEY);
    expect(path).toContain('snapshots');
    expect(path).not.toContain('screenshots');
  });

  it('has the same filename pattern as screenshotPath but under snapshots/', () => {
    const snapshotFilename = snapshotPath(BASE_KEY).split('/').at(-1);
    const screenshotFilename = screenshotPath(BASE_KEY).split('/').at(-1);
    // Same filename, different parent directories
    expect(snapshotFilename).toBe(screenshotFilename);
    expect(snapshotPath(BASE_KEY)).not.toBe(screenshotPath(BASE_KEY));
  });

  it('includes slug, theme, viewport, and fixture', () => {
    const path = snapshotPath(BASE_KEY);
    expect(path).toContain('button');
    expect(path).toContain('light-desktop-default.png');
  });

  it('uses fixture name in the filename for non-default fixtures', () => {
    const path = snapshotPath({ ...BASE_KEY, fixture: 'open' });
    expect(path).toContain('light-desktop-open.png');
  });

  it('places the file inside a slug-named subdirectory under snapshots/', () => {
    const path = snapshotPath(BASE_KEY);
    expect(path).toMatch(/snapshots[/\\]button[/\\]light-desktop-default\.png$/);
  });
});

// ---------------------------------------------------------------------------
// axeJsonPath
// ---------------------------------------------------------------------------

describe('axeJsonPath', () => {
  it('produces a .json file path', () => {
    const path = axeJsonPath(BASE_KEY);
    expect(path).toEndWith('.json');
  });

  it('includes the slug, theme, viewport, and fixture', () => {
    const path = axeJsonPath(BASE_KEY);
    expect(path).toContain('button');
    expect(path).toContain('light-desktop-default.json');
  });

  it('lives under test-results/axe/', () => {
    const path = axeJsonPath(BASE_KEY);
    expect(path).toMatch(/test-results[/\\]axe[/\\]button[/\\]light-desktop-default\.json$/);
  });

  it('uses fixture name for non-default fixtures', () => {
    const path = axeJsonPath({ ...BASE_KEY, fixture: 'hovered' });
    expect(path).toContain('light-desktop-hovered.json');
  });
});

// ---------------------------------------------------------------------------
// Cross-path consistency
// ---------------------------------------------------------------------------

describe('path consistency across key dimensions', () => {
  it('all three paths share the same theme-viewport-fixture basename pattern', () => {
    const key: ArtifactKey = { slug: 'badge', theme: 'dark', viewport: 'tablet', fixture: 'open' };
    const screenshotFilename = screenshotPath(key).split('/').at(-1)!;
    const snapshotFilename = snapshotPath(key).split('/').at(-1)!;
    const axeFilename = axeJsonPath(key).split('/').at(-1)!.replace('.json', '.png');

    expect(screenshotFilename).toBe('dark-tablet-open.png');
    expect(snapshotFilename).toBe('dark-tablet-open.png');
    expect(axeFilename).toBe('dark-tablet-open.png');
  });

  it('changing only the fixture produces a distinct path for all three functions', () => {
    const keyA: ArtifactKey = { ...BASE_KEY, fixture: 'default' };
    const keyB: ArtifactKey = { ...BASE_KEY, fixture: 'disabled' };

    expect(screenshotPath(keyA)).not.toBe(screenshotPath(keyB));
    expect(snapshotPath(keyA)).not.toBe(snapshotPath(keyB));
    expect(axeJsonPath(keyA)).not.toBe(axeJsonPath(keyB));
  });
});
