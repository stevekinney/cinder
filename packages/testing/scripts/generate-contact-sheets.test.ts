import { describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { ScreenshotMetadata } from '../src/helpers/screenshot-metadata.ts';
import { generateContactSheets } from './generate-contact-sheets.ts';

async function writeMetadata(
  metadataRoot: string,
  screenshotPath: string,
  overrides: Partial<ScreenshotMetadata> = {},
): Promise<void> {
  const metadata: ScreenshotMetadata = {
    slug: 'button',
    component: 'Button',
    fixture: 'focused',
    category: 'interaction-state',
    theme: 'light',
    viewport: 'desktop',
    route: '/page/button?fixture=focused',
    fixtureContentHash: 'abc123',
    interact: [{ action: 'focus', target: { role: 'button', name: 'Save changes' } }],
    mask: [],
    screenshotPath,
    ...overrides,
  };
  const outputPath = join(
    metadataRoot,
    metadata.slug,
    `${metadata.theme}-${metadata.viewport}-${metadata.fixture}.json`,
  );
  await mkdir(join(metadataRoot, metadata.slug), { recursive: true });
  await writeFile(outputPath, JSON.stringify(metadata, null, 2));
}

describe('generateContactSheets', () => {
  it('groups metadata by category', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cinder-contact-sheets-'));
    const metadataRoot = join(root, 'metadata');
    const screenshotRoot = join(root, 'screenshots');
    const outputRoot = join(root, 'contact-sheets');
    await mkdir(screenshotRoot, { recursive: true });

    const interactionScreenshot = join(screenshotRoot, 'button-focused.png');
    const visualScreenshot = join(screenshotRoot, 'input-filled.png');
    await writeFile(interactionScreenshot, '');
    await writeFile(visualScreenshot, '');
    await writeMetadata(metadataRoot, interactionScreenshot);
    await writeMetadata(metadataRoot, visualScreenshot, {
      slug: 'input',
      component: 'Input',
      fixture: 'filled',
      category: 'visual-contract',
      interact: [],
    });

    const result = await generateContactSheets({ metadataRoot, outputRoot });

    expect(result.categories).toEqual(['interaction-state', 'visual-contract']);
    const interactionSheet = await readFile(join(outputRoot, 'interaction-state.html'), 'utf8');
    const visualSheet = await readFile(join(outputRoot, 'visual-contract.html'), 'utf8');
    expect(interactionSheet).toContain('Button');
    expect(interactionSheet).toContain('focused');
    expect(visualSheet).toContain('Input');
    expect(visualSheet).toContain('filled');
  });

  it('fails clearly when metadata references a missing screenshot', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cinder-contact-sheets-'));
    const metadataRoot = join(root, 'metadata');
    const outputRoot = join(root, 'contact-sheets');
    const missingScreenshot = join(root, 'screenshots', 'missing.png');
    await writeMetadata(metadataRoot, missingScreenshot);

    await expect(generateContactSheets({ metadataRoot, outputRoot })).rejects.toThrow(
      /missing screenshot/,
    );
  });

  it('escapes metadata fields and image paths in generated HTML', async () => {
    const root = await mkdtemp(join(tmpdir(), 'cinder-contact-sheets-'));
    const metadataRoot = join(root, 'metadata');
    const screenshotRoot = join(root, 'screenshots');
    const outputRoot = join(root, 'contact-sheets');
    await mkdir(screenshotRoot, { recursive: true });

    const screenshot = join(screenshotRoot, 'button-<danger>&"save".png');
    await writeFile(screenshot, '');
    await writeMetadata(metadataRoot, screenshot, {
      slug: 'button-<danger>',
      component: 'Button <danger> & "save"',
      fixture: 'focused & "quoted"',
      category: 'review<&"state' as never,
    });

    const result = await generateContactSheets({ metadataRoot, outputRoot });

    expect(result.categories).toEqual(['review<&"state']);
    const sheet = await readFile(join(outputRoot, 'review<&"state.html'), 'utf8');
    const index = await readFile(join(outputRoot, 'index.html'), 'utf8');
    expect(sheet).toContain('Button &lt;danger&gt; &amp; &quot;save&quot;');
    expect(sheet).toContain('button-&lt;danger&gt; / focused &amp; &quot;quoted&quot;');
    expect(sheet).toContain('button-&lt;danger&gt;&amp;&quot;save&quot;.png');
    expect(index).toContain('review&lt;&amp;&quot;state');
  });
});
