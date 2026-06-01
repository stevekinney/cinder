import { existsSync, readFileSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import { parseComponentScopeValue } from '../src/helpers/component-filter.ts';

export const BASELINE_PROVENANCE_SCHEMA_VERSION = 1;

export type BaselineComponentScope = 'all' | string[];

export type BaselineProvenance = {
  schemaVersion: typeof BASELINE_PROVENANCE_SCHEMA_VERSION;
  componentScope: BaselineComponentScope;
  renderedSourceSha: string;
  playwrightVersion: string;
  osCodename: string;
  architecture: string;
  dockerImageTag: string;
};

export type BaselineProvenanceInput = {
  componentScope: BaselineComponentScope | string | undefined;
  renderedSourceSha: string;
  playwrightVersion: string;
  osCodename: string;
  architecture: string;
  dockerImageTag: string;
};

export function dockerImageTagForPlaywrightVersion(playwrightVersion: string): string {
  return `cinder-playwright:${playwrightVersion}`;
}

export function readOsCodename(path = '/etc/os-release'): string | undefined {
  if (!existsSync(path)) return undefined;
  const raw = readFileSync(path, 'utf8');
  const match = /^VERSION_CODENAME=(.+)$/m.exec(raw);
  return match?.[1]?.replace(/['"]/g, '').trim();
}

export function normalizeProvenanceComponentScope(
  componentScope: BaselineComponentScope | string | undefined,
): BaselineComponentScope {
  if (componentScope === 'all') return 'all';
  if (Array.isArray(componentScope)) {
    return [...new Set(componentScope.map((slug) => slug.trim()).filter(Boolean))].toSorted();
  }
  return parseComponentScopeValue(componentScope);
}

export function createBaselineProvenance(input: BaselineProvenanceInput): BaselineProvenance {
  const componentScope = normalizeProvenanceComponentScope(input.componentScope);
  if (componentScope !== 'all' && componentScope.length === 0) {
    throw new Error('baseline provenance requires an explicit component scope');
  }

  return {
    schemaVersion: BASELINE_PROVENANCE_SCHEMA_VERSION,
    componentScope,
    renderedSourceSha: input.renderedSourceSha,
    playwrightVersion: input.playwrightVersion,
    osCodename: input.osCodename,
    architecture: input.architecture,
    dockerImageTag: input.dockerImageTag,
  };
}

export async function writeBaselineProvenance(
  path: string,
  provenance: BaselineProvenance,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, `${JSON.stringify(provenance, null, 2)}\n`);
}
