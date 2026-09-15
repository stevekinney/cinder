import { expect, test } from 'bun:test';
import { resolveToken } from './resolve-values.ts';
import type { TraceMetadata, TraceState } from './trace.ts';
import type { DesignToken } from './types.ts';

test('partial trace metadata preserves resolution without fabricating dependency sources', () => {
  const target: DesignToken = { $type: 'number', $value: 4 };
  const untraced: DesignToken = { $type: 'number', $value: '{target}' };
  const traced: DesignToken = { $type: 'number', $value: '{untraced}' };
  const tokens = new Map([
    ['target', target],
    ['untraced', untraced],
    ['traced', traced],
  ]);
  const location = {
    documentId: 'source.json',
    tokenPath: 'traced',
    sourcePointer: '/traced',
    sourceIndex: 0,
  };
  const metadata: TraceMetadata = {
    location,
    contributions: [location],
    typeOrigin: location,
    dependencies: [],
  };
  const traceState: TraceState = {
    nodes: new WeakMap([[traced, metadata]]),
    groups: new WeakMap(),
    groupTypes: new WeakMap(),
  };
  expect(
    resolveToken(
      'traced',
      tokens,
      new Map(),
      new Set(),
      new Set(),
      new Map(),
      new Set(),
      traceState,
    ).$value,
  ).toBe(4);
  expect(untraced.$value).toBe(4);
  expect(metadata.dependencies).toEqual([
    {
      kind: 'alias',
      source: { ...location, sourcePointer: '/traced/$value' },
      targetPath: 'untraced',
    },
  ]);
  expect(traceState.nodes.has(untraced)).toBe(false);
});
