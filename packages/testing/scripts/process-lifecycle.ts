import { type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { rmSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import {
  captureProcessSnapshot,
  snapshotIdentities,
  snapshotIsComplete,
  type ProcessIdentity,
  type ProcessSnapshot,
  type ProcessSnapshotReader,
} from './process-identity.ts';

const CHILD_PROCESS_TERMINATION_GRACE_MS = 5_000;

export type ManagedChildProcess = {
  childProcess: ChildProcess;
  name: string;
  ownedProcessIdentities?: Map<number, ProcessIdentity>;
  processSnapshot?: ProcessSnapshotReader;
  rootProcessIdentity?: ProcessIdentity;
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

function descendantProcessIdentities(
  rootPid: number,
  snapshot: readonly ProcessIdentity[],
): ProcessIdentity[] {
  const childrenByParent = new Map<number, ProcessIdentity[]>();
  for (const identity of snapshot)
    childrenByParent.set(identity.parentPid, [
      ...(childrenByParent.get(identity.parentPid) ?? []),
      identity,
    ]);
  const descendants: ProcessIdentity[] = [];
  const pending = [...(childrenByParent.get(rootPid) ?? [])];
  while (pending.length > 0) {
    const identity = pending.shift()!;
    descendants.push(identity);
    pending.push(...(childrenByParent.get(identity.pid) ?? []));
  }
  return descendants;
}

function processGroupIdentities(
  groupId: number,
  snapshot: readonly ProcessIdentity[],
): ProcessIdentity[] {
  return snapshot.filter((identity) => identity.groupId === groupId && identity.pid !== groupId);
}

function identityMatches(current: ProcessIdentity, expected: ProcessIdentity): boolean {
  return current.pid === expected.pid && current.startTime === expected.startTime;
}

function rootIdentityIsAnchored(
  snapshot: readonly ProcessIdentity[],
  rootIdentity: ProcessIdentity | undefined,
): boolean {
  return (
    rootIdentity !== undefined &&
    snapshot.some((identity) => identityMatches(identity, rootIdentity))
  );
}

function snapshotObservedProcess(
  snapshot: readonly ProcessIdentity[] | { observedPids: readonly number[] },
  pid: number,
): boolean {
  return !('observedPids' in snapshot) || snapshot.observedPids.includes(pid);
}

type IdentityState = 'alive' | 'gone' | 'unknown';

function classifyIdentity(
  snapshot: readonly ProcessIdentity[] | ProcessSnapshot,
  expected: ProcessIdentity,
): IdentityState {
  const current = snapshotIdentities(snapshot).find((identity) => identity.pid === expected.pid);
  if (current !== undefined) return identityMatches(current, expected) ? 'alive' : 'gone';
  if (snapshotIsComplete(snapshot) || !snapshotObservedProcess(snapshot, expected.pid))
    return 'gone';
  return 'unknown';
}

function classifyIdentities(
  snapshot: readonly ProcessIdentity[] | ProcessSnapshot,
  expected: readonly ProcessIdentity[],
): IdentityState[] {
  return expected.map((identity) => classifyIdentity(snapshot, identity));
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

async function waitForProcessIdentitiesToExit(
  processIdentities: readonly ProcessIdentity[],
  snapshotReader: ProcessSnapshotReader,
  timeoutMs: number,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const snapshot = snapshotReader();
    if (snapshot === null) return false;
    const states = classifyIdentities(snapshot, processIdentities);
    if (states.every((state) => state === 'gone')) return true;
    if (states.some((state) => state === 'alive')) {
      await delay(25);
      continue;
    }
    return false;
  }
  const snapshot = snapshotReader();
  if (snapshot === null) return false;
  return classifyIdentities(snapshot, processIdentities).every((state) => state === 'gone');
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
  ownsProcessGroup = false,
  processSnapshot: ProcessSnapshotReader = captureProcessSnapshot,
): ManagedChildProcess {
  const initialSnapshot = childProcess.pid === undefined ? null : processSnapshot();
  const rootProcessIdentity =
    initialSnapshot === null
      ? undefined
      : snapshotIdentities(initialSnapshot).find((identity) => identity.pid === childProcess.pid);
  const managedChildProcess: ManagedChildProcess = {
    childProcess,
    name,
    ownedProcessIdentities: new Map<number, ProcessIdentity>(),
    processSnapshot,
    ...(rootProcessIdentity === undefined ? {} : { rootProcessIdentity }),
    ...(ownsProcessGroup && process.platform !== 'win32' && childProcess.pid !== undefined
      ? { ownedProcessGroupId: childProcess.pid }
      : {}),
  };
  if (childProcess.pid === undefined) return managedChildProcess;
  const trackDescendants = (): void => {
    if (childProcess.pid === undefined || childProcessHasFinished(childProcess)) return;
    const snapshot = processSnapshot();
    if (snapshot === null) return;
    const identities = snapshotIdentities(snapshot);
    const observedRoot = identities.find((identity) => identity.pid === childProcess.pid);
    if (managedChildProcess.rootProcessIdentity === undefined && observedRoot !== undefined)
      managedChildProcess.rootProcessIdentity = observedRoot;
    if (!rootIdentityIsAnchored(identities, managedChildProcess.rootProcessIdentity)) return;
    for (const identity of descendantProcessIdentities(childProcess.pid, identities))
      managedChildProcess.ownedProcessIdentities!.set(identity.pid, identity);
    if (managedChildProcess.ownedProcessGroupId !== undefined)
      for (const identity of processGroupIdentities(
        managedChildProcess.ownedProcessGroupId,
        identities,
      ))
        managedChildProcess.ownedProcessIdentities!.set(identity.pid, identity);
  };
  if (initialSnapshot !== null) trackDescendants();
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
  const processSnapshot = managedChildProcess.processSnapshot ?? captureProcessSnapshot;
  const childFinishedAtStart = childProcessHasFinished(childProcess);
  const cachedIdentities = new Map(managedChildProcess.ownedProcessIdentities ?? []);
  const initialProcessSnapshot = processSnapshot();
  let snapshotUnavailable = initialProcessSnapshot === null;
  if (initialProcessSnapshot !== null) {
    const identities = snapshotIdentities(initialProcessSnapshot);
    const rootIsAnchored = rootIdentityIsAnchored(
      identities,
      managedChildProcess.rootProcessIdentity,
    );
    if (!childFinishedAtStart && rootIsAnchored)
      for (const identity of descendantProcessIdentities(processId, identities))
        cachedIdentities.set(identity.pid, identity);
    if (
      !childFinishedAtStart &&
      managedChildProcess.ownedProcessGroupId !== undefined &&
      rootIsAnchored
    )
      for (const identity of processGroupIdentities(
        managedChildProcess.ownedProcessGroupId,
        identities,
      ))
        cachedIdentities.set(identity.pid, identity);
  }
  const descendantIdentities = [...cachedIdentities.values()];
  if (managedChildProcess.ownershipTimer !== undefined) {
    clearInterval(managedChildProcess.ownershipTimer);
    delete managedChildProcess.ownershipTimer;
  }
  if (snapshotUnavailable && childFinishedAtStart)
    throw new Error(`${name} cleanup cannot verify process identity: snapshot unavailable.`);
  if (
    initialProcessSnapshot !== null &&
    !snapshotIsComplete(initialProcessSnapshot) &&
    childFinishedAtStart
  ) {
    const hasUnknownCachedIdentity = descendantIdentities.some(
      (expected) => classifyIdentity(initialProcessSnapshot, expected) === 'unknown',
    );
    if (hasUnknownCachedIdentity)
      throw new Error(`${name} cleanup cannot verify cached process identity.`);
  }
  const signalDescendants = (signal: NodeJS.Signals): void => {
    for (const expected of descendantIdentities.toReversed()) {
      const signalSnapshot = processSnapshot();
      if (signalSnapshot === null) {
        snapshotUnavailable = true;
        continue;
      }
      const current = snapshotIdentities(signalSnapshot).find(
        (identity) => identity.pid === expected.pid,
      );
      if (current !== undefined && identityMatches(current, expected))
        signalProcessId(expected.pid, signal);
      else if (
        current !== undefined ||
        snapshotIsComplete(signalSnapshot) ||
        !snapshotObservedProcess(signalSnapshot, expected.pid)
      )
        managedChildProcess.ownedProcessIdentities?.delete(expected.pid);
    }
  };
  signalDescendants('SIGTERM');
  const rootFinishedBeforeTermination = childProcessHasFinished(childProcess);
  if (!rootFinishedBeforeTermination) {
    try {
      childProcess.kill('SIGTERM');
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error
          ? (error as { code?: unknown }).code
          : undefined;
      if (code !== 'ESRCH') console.error(`Failed to send SIGTERM to ${name}:`, error);
    }
  }
  const [rootExited, descendantsExited] = await Promise.all([
    rootFinishedBeforeTermination
      ? Promise.resolve(true)
      : waitForExitOrTimeout(childProcess, CHILD_PROCESS_TERMINATION_GRACE_MS),
    waitForProcessIdentitiesToExit(
      descendantIdentities,
      processSnapshot,
      CHILD_PROCESS_TERMINATION_GRACE_MS,
    ),
  ]);
  if (rootExited && descendantsExited && !snapshotUnavailable) {
    const stdioClosed = await waitForStdioCloseOrTimeout(
      childProcess,
      CHILD_PROCESS_TERMINATION_GRACE_MS,
    );
    if (!stdioClosed) throw new Error(`${name} cleanup could not verify stdio closure.`);
    return;
  }
  console.error(`${name} did not exit after SIGTERM; sending SIGKILL.`);
  signalDescendants('SIGKILL');
  const rootFinishedBeforeKill = childProcessHasFinished(childProcess);
  if (!rootFinishedBeforeKill) {
    try {
      childProcess.kill('SIGKILL');
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
    waitForProcessIdentitiesToExit(
      descendantIdentities,
      processSnapshot,
      CHILD_PROCESS_TERMINATION_GRACE_MS,
    ),
  ]);
  const stdioClosed = await waitForStdioCloseOrTimeout(
    childProcess,
    CHILD_PROCESS_TERMINATION_GRACE_MS,
  );
  if (!(killedRoot && killedDescendants && stdioClosed && !snapshotUnavailable))
    throw new Error(`${name} cleanup could not verify process termination.`);
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
