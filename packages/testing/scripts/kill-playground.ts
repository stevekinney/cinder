import { spawnSync } from 'node:child_process';

/**
 * Convenience script that finds and stops stray playground server
 * processes — the ones people otherwise hunt down by hand with `ps`/`lsof`.
 *
 * Finds two overlapping sets of processes and kills their union:
 *   1. Anything listening on a port in `PLAYGROUND_PORT_RANGE` (the ports
 *      `createHttpServerOnAvailablePort` scans through in playground-server.ts).
 *   2. Any `bun --watch ... playground-server.ts` process (the dev-loop entry
 *      point started outside the test wrapper, which may not be bound to a
 *      port this scan catches if it's still starting up).
 *
 * Prints what it found before signaling anything, then SIGTERMs and
 * escalates to SIGKILL for stragglers — same "tell, don't surprise" spirit
 * as start-server.ts's cleanup, just aimed at processes this script did not
 * itself spawn.
 */

export const PLAYGROUND_PORT_RANGE = { start: 5555, end: 5560 } as const;

export function lsofPortRangeArguments(range: { start: number; end: number }): string[] {
  return ['-ti', `tcp:${range.start}-${range.end}`, '-sTCP:LISTEN'];
}

export function parsePidListOutput(output: string): number[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => Number(line))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

export function psSnapshotArguments(): string[] {
  return ['-A', '-o', 'pid=,command='];
}

/**
 * Parse `ps -A -o pid=,command=` output and return the pids of any process
 * whose command line looks like a playground dev-watch process.
 */
export function parsePlaygroundWatchProcesses(psOutput: string): number[] {
  const pids: number[] = [];
  for (const line of psOutput.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    const match = trimmed.match(/^(\d+)\s+(.*)$/);
    if (!match) continue;
    const pidText = match[1];
    const command = match[2];
    if (pidText === undefined || command === undefined) continue;
    if (!command.includes('bun') || !command.includes('--watch')) continue;
    if (!command.includes('playground-server')) continue;
    const pid = Number(pidText);
    if (Number.isInteger(pid) && pid > 0) pids.push(pid);
  }
  return pids;
}

export function mergeUniquePids(...pidLists: number[][]): number[] {
  return [...new Set(pidLists.flat())].toSorted((a, b) => a - b);
}

function runCommand(command: string, args: readonly string[]): { status: number; stdout: string } {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return { status: result.status ?? 1, stdout: result.stdout ?? '' };
}

function findListeningPlaygroundPids(): number[] {
  const { stdout } = runCommand('lsof', lsofPortRangeArguments(PLAYGROUND_PORT_RANGE));
  return parsePidListOutput(stdout);
}

function findPlaygroundWatchPids(): number[] {
  const { stdout } = runCommand('ps', psSnapshotArguments());
  return parsePlaygroundWatchProcesses(stdout);
}

const SIGTERM_GRACE_MS = 2_000;

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function terminatePid(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGTERM');
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code !== 'ESRCH') console.error(`Failed to send SIGTERM to pid ${pid}:`, error);
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, SIGTERM_GRACE_MS));

  if (!processIsAlive(pid)) return;

  console.error(`pid ${pid} did not exit after SIGTERM; sending SIGKILL.`);
  try {
    process.kill(pid, 'SIGKILL');
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (code !== 'ESRCH') console.error(`Failed to send SIGKILL to pid ${pid}:`, error);
  }
}

async function main(): Promise<void> {
  const listeningPids = findListeningPlaygroundPids();
  const watchPids = findPlaygroundWatchPids();
  const pids = mergeUniquePids(listeningPids, watchPids);

  if (pids.length === 0) {
    console.log(
      `No playground server processes found (checked ports ${PLAYGROUND_PORT_RANGE.start}-${PLAYGROUND_PORT_RANGE.end} and bun --watch playground-server processes).`,
    );
    return;
  }

  console.log(`Found ${pids.length} playground server process(es): ${pids.join(', ')}`);
  await Promise.all(pids.map((pid) => terminatePid(pid)));
  console.log('Done.');
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('kill-playground failed:', error);
    process.exit(1);
  });
}
