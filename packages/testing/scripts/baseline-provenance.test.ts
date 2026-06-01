import { describe, expect, it } from 'bun:test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  createBaselineProvenance,
  dockerImageTagForPlaywrightVersion,
  readOsCodename,
  writeBaselineProvenance,
} from './baseline-provenance.ts';

describe('baseline provenance', () => {
  it('creates deterministic provenance for a scoped baseline set', () => {
    const provenance = createBaselineProvenance({
      componentScope: 'button,button',
      renderedSourceSha: 'abc123',
      playwrightVersion: '1.60.0',
      osCodename: 'jammy',
      architecture: 'x64',
      dockerImageTag: dockerImageTagForPlaywrightVersion('1.60.0'),
    });

    expect(provenance).toEqual({
      schemaVersion: 1,
      componentScope: ['button'],
      renderedSourceSha: 'abc123',
      playwrightVersion: '1.60.0',
      osCodename: 'jammy',
      architecture: 'x64',
      dockerImageTag: 'cinder-playwright:1.60.0',
    });
    expect(JSON.stringify(provenance)).not.toContain('timestamp');
  });

  it('requires an explicit component scope', () => {
    expect(() =>
      createBaselineProvenance({
        componentScope: '',
        renderedSourceSha: 'abc123',
        playwrightVersion: '1.60.0',
        osCodename: 'jammy',
        architecture: 'x64',
        dockerImageTag: 'cinder-playwright:1.60.0',
      }),
    ).toThrow(/explicit component scope/);
  });

  it('serializes full-matrix provenance with an explicit all scope', () => {
    const provenance = createBaselineProvenance({
      componentScope: 'all',
      renderedSourceSha: 'abc123',
      playwrightVersion: '1.60.0',
      osCodename: 'jammy',
      architecture: 'x64',
      dockerImageTag: 'cinder-playwright:1.60.0',
    });

    expect(provenance.componentScope).toBe('all');
  });

  it('reads the Ubuntu codename from os-release', () => {
    const dir = mkdtempSync(join(tmpdir(), 'baseline-provenance-'));
    const osReleasePath = join(dir, 'os-release');
    writeFileSync(osReleasePath, 'NAME="Ubuntu"\nVERSION_CODENAME=jammy\n');
    expect(readOsCodename(osReleasePath)).toBe('jammy');
  });

  it('writes stable JSON without timestamp fields', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'baseline-provenance-'));
    const path = join(dir, 'snapshots', 'provenance.json');
    await writeBaselineProvenance(
      path,
      createBaselineProvenance({
        componentScope: ['button'],
        renderedSourceSha: 'abc123',
        playwrightVersion: '1.60.0',
        osCodename: 'jammy',
        architecture: 'x64',
        dockerImageTag: 'cinder-playwright:1.60.0',
      }),
    );

    const raw = readFileSync(path, 'utf8');
    expect(raw).toContain('"componentScope": [');
    expect(raw).not.toContain('timestamp');
  });
});
