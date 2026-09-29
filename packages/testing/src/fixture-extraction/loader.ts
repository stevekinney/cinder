import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';

import { fixtureRenderMode, type VisualFixture } from '../visual-fixtures.ts';
import { parseFixtureFileStatic } from './parser.ts';
import type { FileParseResult, FixtureFileEntry } from './types.ts';

const COMPONENT_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function sha256(contents: string): string {
  return createHash('sha256').update(contents).digest('hex');
}

export function resolveFixtureFilePath(slug: string, componentsRoot: string): string {
  if (!COMPONENT_NAME_PATTERN.test(slug)) {
    throw new Error(
      `Invalid component slug '${slug}' — must match ${String(COMPONENT_NAME_PATTERN)}`,
    );
  }
  return join(componentsRoot, slug, `${slug}-fixtures.ts`);
}

export function resolveFixtureHostPath(entry: FixtureFileEntry, fixture: VisualFixture): string {
  if (fixtureRenderMode(fixture) !== 'host') {
    throw new Error(`[${entry.componentName}] Fixture '${fixture.name}' is not a host fixture`);
  }
  if (typeof fixture.host !== 'string') {
    throw new Error(`[${entry.componentName}] Fixture '${fixture.name}' host is missing`);
  }
  if (!fixture.host.startsWith('./')) {
    throw new Error(
      `[${entry.componentName}] Fixture '${fixture.name}' host must be a relative './*.fixture.svelte' path`,
    );
  }
  if (!fixture.host.endsWith('.fixture.svelte')) {
    throw new Error(
      `[${entry.componentName}] Fixture '${fixture.name}' host '${fixture.host}' must end in .fixture.svelte`,
    );
  }

  const componentDirectory = dirname(entry.sourcePath);
  const hostPath = resolve(componentDirectory, fixture.host);
  const relativeHostPath = relative(componentDirectory, hostPath);
  if (relativeHostPath.startsWith('..') || isAbsolute(relativeHostPath)) {
    throw new Error(
      `[${entry.componentName}] Fixture '${fixture.name}' host '${fixture.host}' must stay inside the component directory`,
    );
  }
  return hostPath;
}

function validateHostFixtures(entry: FixtureFileEntry): string[] {
  const violations: string[] = [];
  for (const fixture of entry.fixtures) {
    if (fixtureRenderMode(fixture) !== 'host') continue;
    try {
      resolveFixtureHostPath(entry, fixture);
    } catch (error: unknown) {
      violations.push(error instanceof Error ? error.message : String(error));
    }
  }
  return violations;
}

async function fixtureContentHash(
  entry: FixtureFileEntry,
  fixtureFileContents: string,
): Promise<string> {
  const hostInputs: Array<{ path: string; contents: string }> = [];
  const seenHosts = new Set<string>();
  for (const fixture of entry.fixtures) {
    if (fixtureRenderMode(fixture) !== 'host' || typeof fixture.host !== 'string') continue;
    if (seenHosts.has(fixture.host)) continue;
    seenHosts.add(fixture.host);
    const hostPath = resolveFixtureHostPath(entry, fixture);
    hostInputs.push({
      path: fixture.host.replaceAll('\\', '/'),
      contents: await readFile(hostPath, 'utf8'),
    });
  }
  if (hostInputs.length === 0) return sha256(fixtureFileContents);
  hostInputs.sort((a, b) => a.path.localeCompare(b.path));
  return sha256(JSON.stringify({ fixtureFile: fixtureFileContents, hosts: hostInputs }));
}

export async function loadFixtureFile(sourcePath: string): Promise<FileParseResult> {
  const contents = await readFile(sourcePath, 'utf8');
  const result = parseFixtureFileStatic(sourcePath, contents);
  if (result.kind !== 'entry') return result;

  const hostViolations = validateHostFixtures(result.entry);
  if (hostViolations.length > 0) return { kind: 'violations', violations: hostViolations };
  for (const fixture of result.entry.fixtures) {
    if (fixtureRenderMode(fixture) !== 'host' || typeof fixture.host !== 'string') continue;
    const hostPath = resolveFixtureHostPath(result.entry, fixture);
    if (!existsSync(hostPath)) {
      return {
        kind: 'violations',
        violations: [
          `[${result.entry.componentName}] Fixture '${fixture.name}' host '${fixture.host}' does not exist`,
        ],
      };
    }
  }
  return {
    kind: 'entry',
    entry: { ...result.entry, contentHash: await fixtureContentHash(result.entry, contents) },
  };
}
