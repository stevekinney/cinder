import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Theme = 'light' | 'dark';
export type ViewportName = 'mobile' | 'tablet' | 'desktop';
export type Viewport = { name: ViewportName; width: number; height: number };
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
  fixtures?: Array<{ name: string }>;
};

export const THEMES: readonly Theme[] = ['light', 'dark'] as const;
export const VIEWPORTS: readonly Viewport[] = [
  { name: 'mobile', width: 375, height: 900 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

type ManifestFile = { digest: string; entries: ComponentEntry[] };

let cached: ManifestFile | null = null;

function manifestPath(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // src/helpers/manifest.ts → ../../.playwright/manifest.json
  return resolve(here, '..', '..', '.playwright', 'manifest.json');
}

function read(): ManifestFile {
  if (cached) return cached;
  const path = manifestPath();
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (error) {
    throw new Error(
      `Manifest cache missing at ${path}. Run \`bun run test:browser\` (which invokes scripts/start-server.ts → scripts/prepare-manifest.ts) before loading this module.`,
      { cause: error },
    );
  }
  cached = JSON.parse(raw) as ManifestFile;
  return cached;
}

export function loadManifest(): ComponentEntry[] {
  return read().entries;
}

export function manifestDigest(): string {
  return read().digest;
}
