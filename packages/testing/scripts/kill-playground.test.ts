import { describe, expect, test } from 'bun:test';

import {
  lsofPortRangeArguments,
  mergeUniquePids,
  parsePidListOutput,
  parsePlaygroundWatchProcesses,
  PLAYGROUND_PORT_RANGE,
  psSnapshotArguments,
} from './kill-playground.ts';

describe('lsofPortRangeArguments', () => {
  test('scopes the lsof probe to listening sockets in the playground port range', () => {
    expect(lsofPortRangeArguments(PLAYGROUND_PORT_RANGE)).toEqual([
      '-ti',
      'tcp:5555-5560',
      '-sTCP:LISTEN',
    ]);
  });
});

describe('parsePidListOutput', () => {
  test('parses newline-separated pids from lsof -t output', () => {
    expect(parsePidListOutput('1234\n5678\n')).toEqual([1234, 5678]);
  });

  test('returns an empty array for empty output', () => {
    expect(parsePidListOutput('')).toEqual([]);
  });

  test('ignores blank lines and non-numeric noise', () => {
    expect(parsePidListOutput('1234\n\n  \nnot-a-pid\n5678')).toEqual([1234, 5678]);
  });
});

describe('psSnapshotArguments', () => {
  test('requests a plain pid+command snapshot of every process', () => {
    expect(psSnapshotArguments()).toEqual(['-A', '-o', 'pid=,command=']);
  });
});

describe('parsePlaygroundWatchProcesses', () => {
  test('matches a bun --watch playground-server process', () => {
    const output = [
      '1  /sbin/launchd',
      '4242 bun --watch src/playground-server.ts',
      '9999 some-other-process --watch',
    ].join('\n');

    expect(parsePlaygroundWatchProcesses(output)).toEqual([4242]);
  });

  test('does not match bun --watch processes for unrelated scripts', () => {
    const output = '4242 bun --watch scripts/some-other-tool.ts';
    expect(parsePlaygroundWatchProcesses(output)).toEqual([]);
  });

  test('does not match a plain (non-watch) playground-server process', () => {
    const output = '4242 bun run src/playground-server.ts';
    expect(parsePlaygroundWatchProcesses(output)).toEqual([]);
  });

  test('returns an empty array for empty output', () => {
    expect(parsePlaygroundWatchProcesses('')).toEqual([]);
  });
});

describe('mergeUniquePids', () => {
  test('deduplicates and sorts pids from multiple sources', () => {
    expect(mergeUniquePids([5678, 1234], [1234, 9999])).toEqual([1234, 5678, 9999]);
  });

  test('returns an empty array when every source is empty', () => {
    expect(mergeUniquePids([], [])).toEqual([]);
  });
});
