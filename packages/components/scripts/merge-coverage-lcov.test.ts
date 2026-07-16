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
});
