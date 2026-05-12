import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type Theme = 'light' | 'dark';
export type ViewportName = 'mobile' | 'tablet' | 'desktop';
export type Viewport = { name: ViewportName; width: number; height: number };
export type ComponentEntry = { name: string; slug: string; route: string };

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
