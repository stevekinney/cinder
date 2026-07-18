import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { packageTarballPath } from './report-package-weight.ts';

describe('package-weight artifact selection', () => {
  test('selects only the artifact matching the source manifest version', () => {
    expect(
      packageTarballPath('/workspace/packages/components', {
        name: '@lostgradient/cinder',
        version: '0.15.0',
      }),
    ).toBe('/workspace/packages/components/lostgradient-cinder-0.15.0.tgz');
  });

  test('derives the Chat artifact independently', () => {
    expect(
      packageTarballPath('/workspace/packages/chat', {
        name: '@lostgradient/chat',
        version: '0.1.0',
      }),
    ).toBe('/workspace/packages/chat/lostgradient-chat-0.1.0.tgz');
  });
});

describe('package-weight budget gates', () => {
  test('the Chat check script enables budget assertions', () => {
    const workspaceRoot = resolve(import.meta.dirname, '../../..');
    const manifest = JSON.parse(
      readFileSync(resolve(workspaceRoot, 'packages/chat/package.json'), 'utf8'),
    ) as { scripts: Record<string, string> };
    const weightCheckScript = manifest.scripts['package:weight:check'];
    if (weightCheckScript === undefined) throw new Error('Chat package weight check is missing');

    expect(weightCheckScript.split(/\s+/)).toContain('--check');
  });
});
