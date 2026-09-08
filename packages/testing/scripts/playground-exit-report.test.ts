import { describe, expect, it } from 'bun:test';

import { describePlaygroundExit } from './start-server.ts';

describe('describePlaygroundExit', () => {
  it('names the exit and says the browser failures are downstream of it', () => {
    const report = describePlaygroundExit({ code: 137, signal: null, output: '' });
    expect(report).toContain('code=137');
    expect(report).toContain('signal=null');
    // The point of the message: without it, dozens of ERR_CONNECTION_REFUSED
    // navigations read as the branch under test being broken.
    expect(report).toContain('not their own cause');
  });

  it('reports a signal death as well as an exit code', () => {
    const report = describePlaygroundExit({ code: null, signal: 'SIGKILL', output: '' });
    expect(report).toContain('code=null');
    expect(report).toContain('signal=SIGKILL');
  });

  it("keeps the server's last words, bounded to the final lines", () => {
    const output = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n');
    const report = describePlaygroundExit({ code: 1, signal: null, output });
    expect(report).toContain('Last playground output:');
    expect(report).toContain('line 40');
    expect(report).toContain('line 21');
    expect(report).not.toContain('line 20');
  });

  it('omits the output section when the server said nothing', () => {
    expect(describePlaygroundExit({ code: 0, signal: null, output: '   \n  ' })).not.toContain(
      'Last playground output',
    );
  });
});
