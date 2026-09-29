import { readFileSync } from 'node:fs';
import { environmentConfiguration } from '../environment-configuration.ts';
import type { FixtureCategory, InteractionStep, MaskRule } from '../visual-fixtures.ts';

export type Theme = 'light' | 'dark';
export type ViewportName = 'mobile' | 'tablet' | 'desktop';
export type Viewport = { name: ViewportName; width: number; height: number };

export type ManifestFixtureEntry = {
  name: string;
  mode: 'direct' | 'host';
  fixtureContentHash: string;
  interact?: InteractionStep[];
  mask?: MaskRule[];
  category: FixtureCategory;
};

/**
 * A single component entry from the manifest. The `fixtures` field is optional:
 * when omitted, the test loop synthesises a single `{ name: 'default' }` fixture
 * so that every component is exercised at least once.
 *
 * When `fixtures` is present and non-empty, the loop iterates over the explicit
 * list instead of the synthesised default.
 */
export type ComponentEntry = {
  name: string;
  slug: string;
  route: string;
  /** Explicit fixture list for components with multiple visual states. When absent, a single `'default'` fixture is used. */
  fixtures?: ManifestFixtureEntry[];
};

export const THEMES: readonly Theme[] = ['light', 'dark'] as const;
export const VIEWPORTS: readonly Viewport[] = [
  { name: 'mobile', width: 375, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

type ManifestFile = { digest: string; entries: ComponentEntry[] };

const cached = new Map<string, ManifestFile>();

function isManifestFile(value: unknown): value is ManifestFile {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { digest?: unknown }).digest === 'string' &&
    Array.isArray((value as { entries?: unknown }).entries)
  );
}

function manifestPath(path: string | undefined): string {
  if (path === undefined || path.length === 0) {
    throw new Error(
      'A browser fixture manifest path is required. Set BROWSER_FIXTURE_MANIFEST before loading the manifest.',
    );
  }
  return path;
}

function read(
  path = manifestPath(environmentConfiguration().browserFixtureManifest),
): ManifestFile {
  const ownedPath = manifestPath(path);
  const existing = cached.get(ownedPath);
  if (existing !== undefined) return existing;
  let raw: string;
  try {
    raw = readFileSync(ownedPath, 'utf-8');
  } catch (error) {
    throw new Error(
      `Browser fixture manifest missing at ${ownedPath}. Run the owning application's manifest preparation command before loading this module.`,
      { cause: error },
    );
  }
  const parsed: unknown = JSON.parse(raw);
  if (!isManifestFile(parsed)) {
    throw new Error(`Manifest cache at ${path} does not match the expected shape.`);
  }
  cached.set(ownedPath, parsed);
  return parsed;
}

export function loadManifest(path?: string): ComponentEntry[] {
  return read(path).entries;
}

export function manifestDigest(path?: string): string {
  return read(path).digest;
}
