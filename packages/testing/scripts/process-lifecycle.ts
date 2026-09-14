import { spawnSync, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { rmSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

const CHILD_PROCESS_TERMINATION_GRACE_MS = 5_000;

export type ManagedChildProcess = {
  childProcess: ChildProcess;
  name: string;
  killProcessGroup: boolean;
  ownedProcessIds?: Set<number>;
  ownershipTimer?: ReturnType<typeof setInterval>;
  ownedProcessGroupId?: number;
};

export function childProcessHasFinished(
  childProcess: Pick<ChildProcess, 'pid' | 'exitCode' | 'signalCode'>,
): boolean {
  return (
    childProcess.pid === undefined ||
    childProcess.exitCode !== null ||
    childProcess.signalCode !== null
  );
}

type ProcessTreeEntry = { pid: number; parentPid: number };
type ProcessGroupEntry = { pid: number; groupId: number };

export function parseProcessTreeSnapshot(output: string): ProcessTreeEntry[] {
  return output
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((columns) => columns.length >= 2)
    .flatMap(([pidText, parentPidText]) => {
      const pid = Number(pidText);
      const parentPid = Number(parentPidText);
      return Number.isInteger(pid) && Number.isInteger(parentPid) && pid > 0 && parentPid > 0
        ? [{ pid, parentPid }]
        : [];
    });
}

export function parseProcessGroupSnapshot(output: string): ProcessGroupEntry[] {
  return output
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((columns) => columns.length >= 2)
    .flatMap(([pidText, groupIdText]) => {
      const pid = Number(pidText);
      const groupId = Number(groupIdText);
      return Number.isInteger(pid) && Number.isInteger(groupId) && pid > 0 && groupId > 0
        ? [{ pid, groupId }]
        : [];
    });
}

export function descendantProcessIds(
  rootPid: number,
  snapshot: readonly ProcessTreeEntry[],
): number[] {
  const childrenByParent = new Map<number, number[]>();
  for (const { pid, parentPid } of snapshot)
    childrenByParent.set(parentPid, [...(childrenByParent.get(parentPid) ?? []), pid]);
  const descendants: number[] = [];
  const pending = [...(childrenByParent.get(rootPid) ?? [])];
  while (pending.length > 0) {
    const pid = pending.shift()!;
    descendants.push(pid);
    pending.push(...(childrenByParent.get(pid) ?? []));
  }
  return descendants;
}

function captureDescendantProcessIds(rootPid: number): number[] {
  if (process.platform === 'win32') return [];
  const result = spawnSync('ps', ['-A', '-o', 'pid=,ppid='], { encoding: 'utf8' });
  return result.status === 0
    ? descendantProcessIds(rootPid, parseProcessTreeSnapshot(result.stdout))
    : [];
}

function captureProcessGroupIds(groupId: number): number[] {
  if (process.platform === 'win32') return [];
  const result = spawnSync('ps', ['-A', '-o', 'pid=,pgid='], { encoding: 'utf8' });
  return result.status === 0
    ? parseProcessGroupSnapshot(result.stdout)
        .filter((entry) => entry.groupId === groupId && entry.pid !== groupId)
        .map((entry) => entry.pid)
    : [];
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function signalProcessId(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(pid, signal);
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code !== 'ESRCH') console.error(`Failed to send ${signal} to descendant ${pid}:`, error);
  }
}

async function waitForProcessIdsToExit(
  processIds: readonly number[],
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (processIds.some(processIsAlive) && Date.now() < deadline) await delay(25);
  return processIds.every((pid) => !processIsAlive(pid));
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

async function waitForExitOrTimeout(
  childProcess: ChildProcess,
  timeoutMs: number,
): Promise<boolean> {
  if (childProcessHasFinished(childProcess)) return true;
  const abortController = new AbortController();
  const exitPromise = once(childProcess, 'exit', { signal: abortController.signal }).then(
    () => 'exited' as const,
    (error: unknown) => (isAbortError(error) ? 'aborted' : 'exited'),
  );
  const errorPromise = once(childProcess, 'error', { signal: abortController.signal }).then(
    ([error]) => {
      console.error('Child process error:', error);
      return 'exited' as const;
    },
    (error: unknown) => (isAbortError(error) ? 'aborted' : 'exited'),
  );
  const timeoutPromise = delay(timeoutMs, 'timeout' as const, {
    signal: abortController.signal,
  }).catch((error: unknown) => {
    if (isAbortError(error)) return 'aborted' as const;
    throw error;
  });
  const result = await Promise.race([exitPromise, errorPromise, timeoutPromise]);
  abortController.abort();
  return result === 'exited' || childProcessHasFinished(childProcess);
}

async function waitForStdioCloseOrTimeout(
  childProcess: ChildProcess,
  timeoutMs: number,
): Promise<boolean> {
  const streams = [childProcess.stdout, childProcess.stderr];
  if (streams.every((stream) => stream === null || stream.readableEnded)) return true;
  const abortController = new AbortController();
  const closePromise = once(childProcess, 'close', { signal: abortController.signal }).then(
    () => 'closed' as const,
    (error: unknown) => (isAbortError(error) ? 'aborted' : 'closed'),
  );
  const timeoutPromise = delay(timeoutMs, 'timeout' as const, {
    signal: abortController.signal,
  }).catch((error: unknown) => {
    if (isAbortError(error)) return 'aborted' as const;
    throw error;
  });
  const result = await Promise.race([closePromise, timeoutPromise]);
  abortController.abort();
  return result === 'closed';
}

export function manageChildProcess(
  childProcess: ChildProcess,
  name: string,
  killProcessGroup: boolean,
  ownsProcessGroup = false,
): ManagedChildProcess {
  const managedChildProcess: ManagedChildProcess = {
    childProcess,
    name,
    killProcessGroup,
    ownedProcessIds: new Set<number>(),
    ...(ownsProcessGroup && process.platform !== 'win32' && childProcess.pid !== undefined
      ? { ownedProcessGroupId: childProcess.pid }
      : {}),
  };
  if (childProcess.pid === undefined) return managedChildProcess;
  const trackDescendants = (): void => {
    if (childProcess.pid === undefined || childProcessHasFinished(childProcess)) return;
    for (const pid of captureDescendantProcessIds(childProcess.pid))
      managedChildProcess.ownedProcessIds!.add(pid);
  };
  trackDescendants();
  managedChildProcess.ownershipTimer = setInterval(trackDescendants, 25);
  return managedChildProcess;
}

export function waitForExit(childProcess: ChildProcess): Promise<number> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (code: number): void => {
      if (settled) return;
      settled = true;
      childProcess.off('exit', onExit);
      childProcess.off('error', onError);
      resolve(code);
    };
    const onExit = (code: number | null): void => settle(code ?? 1);
    const onError = (error: Error): void => {
      console.error('Child process error:', error);
      settle(1);
    };
    childProcess.on('exit', onExit);
    childProcess.on('error', onError);
    if (childProcess.exitCode !== null) settle(childProcess.exitCode);
    else if (childProcess.signalCode !== null) settle(1);
  });
}

export async function terminateChildProcess(
  managedChildProcess: ManagedChildProcess,
): Promise<void> {
  const { childProcess, name } = managedChildProcess;
  const processId = childProcess.pid;
  if (processId === undefined) return;
  const childFinished = childProcessHasFinished(childProcess);
  const descendantPids = [
    ...new Set([
      ...(managedChildProcess.ownedProcessIds ?? []),
      ...captureDescendantProcessIds(processId),
      ...(managedChildProcess.ownedProcessGroupId === undefined
        ? []
        : captureProcessGroupIds(managedChildProcess.ownedProcessGroupId)),
    ]),
  ];
  if (managedChildProcess.ownershipTimer !== undefined) {
    clearInterval(managedChildProcess.ownershipTimer);
    delete managedChildProcess.ownershipTimer;
  }
  const signalOwnedProcessGroup = (signal: NodeJS.Signals): void => {
    const groupId = managedChildProcess.ownedProcessGroupId;
    if (groupId === undefined || process.platform === 'win32' || childFinished) return;
    try {
      process.kill(-groupId, signal);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (code !== 'ESRCH') console.error(`Failed to send ${signal} to ${name} group:`, error);
    }
  };
  for (const pid of [...descendantPids].reverse()) signalProcessId(pid, 'SIGTERM');
  signalOwnedProcessGroup('SIGTERM');
  if (!childFinished) {
    try {
      if (managedChildProcess.killProcessGroup && process.platform !== 'win32')
        process.kill(-processId, 'SIGTERM');
      else childProcess.kill('SIGTERM');
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (code !== 'ESRCH') console.error(`Failed to send SIGTERM to ${name}:`, error);
    }
  }
  const [rootExited, descendantsExited] = await Promise.all([
    childFinished
      ? Promise.resolve(true)
      : waitForExitOrTimeout(childProcess, CHILD_PROCESS_TERMINATION_GRACE_MS),
    waitForProcessIdsToExit(descendantPids, CHILD_PROCESS_TERMINATION_GRACE_MS),
  ]);
  if (rootExited && descendantsExited) {
    await waitForStdioCloseOrTimeout(childProcess, CHILD_PROCESS_TERMINATION_GRACE_MS);
    return;
  }
  console.error(`${name} did not exit after SIGTERM; sending SIGKILL.`);
  for (const pid of descendantPids) if (processIsAlive(pid)) signalProcessId(pid, 'SIGKILL');
  signalOwnedProcessGroup('SIGKILL');
  if (!childFinished) {
    try {
      if (managedChildProcess.killProcessGroup && process.platform !== 'win32')
        process.kill(-processId, 'SIGKILL');
      else childProcess.kill('SIGKILL');
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (code !== 'ESRCH') console.error(`Failed to send SIGKILL to ${name}:`, error);
    }
  }
  const [killedRoot, killedDescendants] = await Promise.all([
    waitForExitOrTimeout(childProcess, CHILD_PROCESS_TERMINATION_GRACE_MS),
    waitForProcessIdsToExit(descendantPids, CHILD_PROCESS_TERMINATION_GRACE_MS),
  ]);
  if (!(killedRoot && killedDescendants))
    console.error(`${name} did not exit after SIGKILL; continuing cleanup.`);
  await waitForStdioCloseOrTimeout(childProcess, CHILD_PROCESS_TERMINATION_GRACE_MS);
}

export async function cleanupManagedChildren(
  children: ManagedChildProcess[],
  playgroundPortFile: string | null,
): Promise<void> {
  await Promise.all(children.map((child) => terminateChildProcess(child)));
  if (playgroundPortFile !== null) rmSync(playgroundPortFile, { force: true });
}

export function installSignalCleanupHandlers(runCleanup: () => Promise<void>): void {
  let cleanupPromise: Promise<void> | null = null;
  const cleanupOnce = async (): Promise<void> => {
    cleanupPromise ??= runCleanup();
    await cleanupPromise;
  };
  const exitAfterCleanup = async (code: number): Promise<never> => {
    try {
      await cleanupOnce();
    } catch (error) {
      console.error('Cleanup failed during shutdown:', error);
    }
    process.exit(code);
  };
  process.on('SIGINT', () => {
    void exitAfterCleanup(130);
  });
  process.on('SIGTERM', () => {
    void exitAfterCleanup(143);
  });
}
