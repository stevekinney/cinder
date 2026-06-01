import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type {
  FixtureCategory,
  InteractionStep,
  MaskRule,
} from '../../../components/scripts/lib/visual-fixtures/schema.ts';
import { screenshotMetadataPath, screenshotPath, type ArtifactKey } from './artifact-path.ts';
import type { Theme, ViewportName } from './manifest.ts';

export type ScreenshotMetadata = {
  slug: string;
  component: string;
  fixture: string;
  category: FixtureCategory;
  theme: Theme;
  viewport: ViewportName;
  route: string;
  fixtureContentHash: string | null;
  interact: InteractionStep[];
  mask: MaskRule[];
  screenshotPath: string;
};

export type ScreenshotMetadataInput = {
  key: ArtifactKey;
  component: string;
  category: FixtureCategory;
  route: string;
  fixtureContentHash?: string | undefined;
  interact?: readonly InteractionStep[] | undefined;
  mask?: readonly MaskRule[] | undefined;
};

export function buildScreenshotMetadata(input: ScreenshotMetadataInput): ScreenshotMetadata {
  return {
    slug: input.key.slug,
    component: input.component,
    fixture: input.key.fixture,
    category: input.category,
    theme: input.key.theme,
    viewport: input.key.viewport,
    route: input.route,
    fixtureContentHash: input.fixtureContentHash ?? null,
    interact: [...(input.interact ?? [])],
    mask: [...(input.mask ?? [])],
    screenshotPath: screenshotPath(input.key),
  };
}

export async function writeScreenshotMetadata(input: ScreenshotMetadataInput): Promise<void> {
  const outputPath = screenshotMetadataPath(input.key);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(buildScreenshotMetadata(input), null, 2) + '\n');
}
