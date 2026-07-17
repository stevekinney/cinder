import { describe, expect, it } from 'bun:test';

import { parseLcovRecords } from './check-coverage-ratchet.ts';
import { mergeLcovSources } from './merge-coverage-lcov.ts';

describe('mergeLcovSources', () => {
  it('merges shard coverage without double-counting source inventory', () => {
    const firstShard = [
      'SF:src/example.ts',
      'FN:1,usedInFirstShard',
      'FN:2,usedInSecondShard',
      'FNDA:1,usedInFirstShard',
      'FNDA:0,usedInSecondShard',
      'FNF:2',
      'FNH:1',
      'DA:1,1',
      'DA:2,0',
      'LF:2',
      'LH:1',
      'end_of_record',
    ].join('\n');
    const secondShard = [
      'SF:src/example.ts',
      'FN:1,usedInFirstShard',
      'FN:2,usedInSecondShard',
      'FNDA:0,usedInFirstShard',
      'FNDA:1,usedInSecondShard',
      'FNF:2',
      'FNH:1',
      'DA:1,0',
      'DA:2,1',
      'LF:2',
      'LH:1',
      'end_of_record',
    ].join('\n');

    const [record] = parseLcovRecords(mergeLcovSources([firstShard, secondShard]));

    expect(record).toEqual({
      file: 'src/example.ts',
      functionsFound: 2,
      functionsHit: 2,
      linesFound: 2,
      linesHit: 2,
    });
  });

  it('keeps duplicate function names distinct instead of collapsing their hit counts', () => {
    const source = [
      'SF:src/example.ts',
      'FN:10,visit',
      'FN:40,visit',
      'FNDA:1,visit',
      'FNDA:0,visit',
      'FNF:2',
      'FNH:1',
      'end_of_record',
    ].join('\n');

    const [record] = parseLcovRecords(mergeLcovSources([source]));

    expect(record).toEqual({
      file: 'src/example.ts',
      functionsFound: 2,
      functionsHit: 1,
      linesFound: 0,
      linesHit: 0,
    });
  });

  it('preserves FNF/FNH summary counts for records with no per-function detail', () => {
    const source = [
      'SF:src/example.ts',
      'FNF:3',
      'FNH:2',
      'DA:1,1',
      'LF:1',
      'LH:1',
      'end_of_record',
    ].join('\n');

    const [record] = parseLcovRecords(mergeLcovSources([source]));

    expect(record).toEqual({
      file: 'src/example.ts',
      functionsFound: 3,
      functionsHit: 2,
      linesFound: 1,
      linesHit: 1,
    });
  });

  it('does not double-count a summary-only inventory reported by multiple shards', () => {
    const shard = ['SF:src/example.ts', 'FNF:3', 'FNH:2', 'end_of_record'].join('\n');

    const [record] = parseLcovRecords(mergeLcovSources([shard, shard]));

    expect(record).toEqual({
      file: 'src/example.ts',
      functionsFound: 3,
      functionsHit: 2,
      linesFound: 0,
      linesHit: 0,
    });
  });

  it('prefers detailed function coverage over a summary-only shard for the same file', () => {
    const detailedShard = [
      'SF:src/example.ts',
      'FN:1,usedInFirstShard',
      'FN:2,usedInSecondShard',
      'FNDA:1,usedInFirstShard',
      'FNDA:0,usedInSecondShard',
      'FNF:2',
      'FNH:1',
      'end_of_record',
    ].join('\n');
    const summaryOnlyShard = ['SF:src/example.ts', 'FNF:2', 'FNH:2', 'end_of_record'].join('\n');

    const [record] = parseLcovRecords(mergeLcovSources([detailedShard, summaryOnlyShard]));

    expect(record).toEqual({
      file: 'src/example.ts',
      functionsFound: 2,
      functionsHit: 1,
      linesFound: 0,
      linesHit: 0,
    });
  });

  it('keeps functions that share a source line distinct', () => {
    const source = [
      'SF:src/example.ts',
      'FN:5,onClick',
      'FN:5,onKeyDown',
      'FNDA:1,onClick',
      'FNDA:0,onKeyDown',
      'FNF:2',
      'FNH:1',
      'end_of_record',
    ].join('\n');

    const [record] = parseLcovRecords(mergeLcovSources([source]));

    expect(record).toEqual({
      file: 'src/example.ts',
      functionsFound: 2,
      functionsHit: 1,
      linesFound: 0,
      linesHit: 0,
    });
  });
});
