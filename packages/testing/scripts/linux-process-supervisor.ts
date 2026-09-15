import { spawn, type ChildProcess } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  enableChildSubreaper,
  reapOneChild,
  type WaitResult,
} from './linux-process-supervisor-native.ts';
import {
  captureProcessSnapshot,
  snapshotIdentities,
  snapshotIsComplete,
  type ProcessIdentity,
} from './process-identity.ts';

const SUPERVISOR_STATUS_FD = 3;
const DRAIN_GRACE_MS = 5_000;

type StdioMode = 'inherit' | 'ignore' | ['ignore', 'pipe', 'pipe'];
type LaunchEnvelope = {
  command: string;
  args: string[];
  cwd?: string;
  stdio: StdioMode;
  environment: NodeJS.ProcessEnv;
};
type TargetResult = { code: number | null; signal: NodeJS.Signals | null };

let statusStream: ReturnType<typeof Bun.file>['writer'] extends () => infer T ? T : never;
let statusClosed = false;
let statusChain = Promise.resolve();
let statusFailure: unknown = null;
function getStatusStream() {
  return (statusStream ??= Bun.file(SUPERVISOR_STATUS_FD).writer());
}
function status(frame: Record<string, unknown>): Promise<void> {
  if (statusClosed) return statusChain;
  statusChain = statusChain
    .then(async () => {
      if (statusFailure !== null) return;
      const stream = getStatusStream();
      await stream.write(`${JSON.stringify(frame)}\n`);
      await stream.flush();
      return undefined;
    })
    .catch((error: unknown) => {
      statusFailure ??= error;
    });
  return statusChain;
}
async function closeStatus(): Promise<void> {
  if (statusClosed) return;
  statusClosed = true;
  await statusChain;
  try {
    await getStatusStream().end();
  } catch (error) {
    statusFailure ??= error;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function decodeLaunchEnvelope(encoded: string): LaunchEnvelope {
  const parsed: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  if (!isRecord(parsed)) throw new Error('invalid supervisor launch envelope');
  const value = parsed;
  const allowed = new Set(['command', 'args', 'cwd', 'stdio']);
  if (Object.keys(value).some((key) => !allowed.has(key)))
    throw new Error('invalid supervisor launch envelope keys');
  if (typeof value['command'] !== 'string' || value['command'].length === 0)
    throw new Error('invalid supervisor command');
  const args = value['args'];
  if (!Array.isArray(args) || args.some((arg) => typeof arg !== 'string'))
    throw new Error('invalid supervisor arguments');
  const stdio = value['stdio'];
  if (stdio !== 'inherit' && stdio !== 'ignore' && !isPipedStdio(stdio))
    throw new Error('invalid supervisor stdio');
  if ('cwd' in value && (typeof value['cwd'] !== 'string' || !isAbsolute(value['cwd'])))
    throw new Error('invalid supervisor working directory');
  const cwd = value['cwd'];
  return {
    command: value['command'],
    args: args.filter((arg): arg is string => typeof arg === 'string'),
    ...('cwd' in value && typeof cwd === 'string' ? { cwd } : {}),
    stdio,
    environment: process.env,
  };
}
function decodeEnvelope(): LaunchEnvelope {
  const encoded = process.env['CINDER_LINUX_SUPERVISOR_ENVELOPE'];
  if (encoded === undefined) throw new Error('missing supervisor launch envelope');
  return decodeLaunchEnvelope(encoded);
}
function isPipedStdio(value: unknown): value is ['ignore', 'pipe', 'pipe'] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value[0] === 'ignore' &&
    value[1] === 'pipe' &&
    value[2] === 'pipe'
  );
}
function targetStdio(stdio: StdioMode): StdioMode {
  return stdio;
}
function requireTargetResult(result: TargetResult | null): TargetResult {
  if (result === null) throw new Error('target exit result missing');
  return result;
}
function identityMatches(current: ProcessIdentity, expected: ProcessIdentity): boolean {
  return current.pid === expected.pid && current.startTime === expected.startTime;
}
function descendantsOf(rootPid: number, identities: readonly ProcessIdentity[]): ProcessIdentity[] {
  const children = new Map<number, ProcessIdentity[]>();
  for (const identity of identities)
    children.set(identity.parentPid, [...(children.get(identity.parentPid) ?? []), identity]);
  const result: ProcessIdentity[] = [];
  const pending = [...(children.get(rootPid) ?? [])];
  while (pending.length > 0) {
    const identity = pending.shift()!;
    result.push(identity);
    pending.push(...(children.get(identity.pid) ?? []));
  }
  return result;
}
function signalIdentity(identity: ProcessIdentity, signal: NodeJS.Signals): void {
  const snapshot = captureProcessSnapshot();
  if (snapshot === null) throw new Error(`cannot verify supervisor child ${identity.pid}`);
  const current = snapshotIdentities(snapshot).find((entry) => entry.pid === identity.pid);
  if (current !== undefined && identityMatches(current, identity)) {
    try {
      process.kill(identity.pid, signal);
    } catch (error) {
      const code =
        typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
      if (code !== 'ESRCH') throw error;
    }
  }
}
function ownedDescendants(supervisorPid: number): ProcessIdentity[] {
  const snapshot = captureProcessSnapshot();
  if (snapshot === null || !snapshotIsComplete(snapshot))
    throw new Error('cannot verify supervisor descendants from a partial snapshot');
  return descendantsOf(supervisorPid, snapshotIdentities(snapshot));
}
export type SupervisorDrainDeadlines = { term: number | null; kill: number | null };

export function startSupervisorDrain(state: SupervisorDrainDeadlines, now: number): void {
  state.term ??= now + DRAIN_GRACE_MS;
}

export function escalateSupervisorDrain(state: SupervisorDrainDeadlines, now: number): void {
  state.term ??= now;
  state.kill ??= Math.min(now, state.term) + DRAIN_GRACE_MS;
}

export function supervisorDrainStage(
  state: SupervisorDrainDeadlines,
  now: number,
): { signal: 'SIGTERM' | 'SIGKILL'; deadline: number } {
  startSupervisorDrain(state, now);
  if (state.kill === null && now >= state.term!) escalateSupervisorDrain(state, now);
  return state.kill === null
    ? { signal: 'SIGTERM', deadline: state.term! }
    : { signal: 'SIGKILL', deadline: state.kill };
}

type DrainOperations = {
  now: () => number;
  owned: () => ProcessIdentity[];
  signal: (identity: ProcessIdentity, signal: NodeJS.Signals) => void;
  reap: () => WaitResult;
  pause: () => Promise<void>;
};

export async function reapSupervisorDescendants(
  deadlines: SupervisorDrainDeadlines,
  operations: DrainOperations = {
    now: Date.now,
    owned: () => ownedDescendants(process.pid),
    signal: signalIdentity,
    reap: reapOneChild,
    pause: () => delay(25),
  },
): Promise<void> {
  const signaled = new Set<string>();
  while (true) {
    const stage = supervisorDrainStage(deadlines, operations.now());
    const adopted = operations.owned();
    const expired = stage.signal === 'SIGKILL' && operations.now() >= stage.deadline;
    if (expired && adopted.length > 0)
      throw new Error(
        `supervisor descendants remain: ${adopted.map((entry) => entry.pid).join(',')}`,
      );
    for (const identity of adopted) {
      const key = `${stage.signal}:${identity.pid}:${identity.startTime}`;
      if (!signaled.has(key)) {
        operations.signal(identity, stage.signal);
        signaled.add(key);
      }
    }
    // Only called after the direct target's exit/error event has settled.
    // A zero result still means a live child exists, even if /proc missed it.
    const reaped = operations.reap();
    if (reaped.result === -1) {
      if (reaped.errno === 10 && adopted.length === 0) return;
      if (reaped.errno !== 4 && reaped.errno !== 10)
        throw new Error(`waitpid failed with errno ${reaped.errno}`);
    }
    if (expired) throw new Error('supervisor drain deadline expired before verified ECHILD');
    if (reaped.result <= 0) await operations.pause();
  }
}
async function proxyStreams(target: ChildProcess, stdio: StdioMode): Promise<void> {
  if (!isPipedStdio(stdio)) return;
  if (target.stdout === null || target.stderr === null) throw new Error('target pipes unavailable');
  await Promise.all([
    forwardStream(target.stdout, process.stdout),
    forwardStream(target.stderr, process.stderr),
  ]);
}
async function forwardStream(
  source: NodeJS.ReadableStream,
  destination: NodeJS.WritableStream,
): Promise<void> {
  for await (const chunk of source as AsyncIterable<Buffer | string>) {
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        destination.off('error', onError);
        reject(error);
      };
      destination.once('error', onError);
      destination.write(Buffer.from(chunk), (error?: Error | null) => {
        destination.off('error', onError);
        if (error === undefined || error === null) resolve();
        else reject(error);
      });
    });
  }
}
async function main(): Promise<void> {
  let envelope: LaunchEnvelope;
  try {
    envelope = decodeEnvelope();
    enableChildSubreaper();
  } catch (error) {
    await status({
      kind: 'error',
      phase: 'startup',
      message: error instanceof Error ? error.message : String(error),
    });
    await closeStatus();
    process.exitCode = 125;
    return;
  }
  let pendingSignal: NodeJS.Signals | null = null;
  let handleSignal = (signal: NodeJS.Signals): void => {
    pendingSignal = signal;
  };
  process.on('SIGTERM', () => handleSignal('SIGTERM'));
  process.on('SIGINT', () => handleSignal('SIGINT'));
  process.on('SIGUSR2', () => handleSignal('SIGUSR2'));
  let target: ChildProcess;
  try {
    target = spawn(envelope.command, envelope.args, {
      cwd: envelope.cwd,
      env: envelope.environment,
      stdio: targetStdio(envelope.stdio),
      detached: false,
    });
  } catch (error) {
    await status({
      kind: 'error',
      phase: 'startup',
      message: error instanceof Error ? error.message : String(error),
    });
    await closeStatus();
    process.exitCode = 125;
    return;
  }
  let targetResult: TargetResult | null = null;
  let startupError: Error | null = null;
  let resolveTarget!: () => void;
  const targetSettled = new Promise<void>((resolve) => {
    resolveTarget = resolve;
  });
  const drainDeadlines: SupervisorDrainDeadlines = { term: null, kill: null };
  let targetKillTimer: ReturnType<typeof setTimeout> | undefined;
  handleSignal = (signal: NodeJS.Signals): void => {
    if (signal === 'SIGUSR2') escalateSupervisorDrain(drainDeadlines, Date.now());
    else startSupervisorDrain(drainDeadlines, Date.now());
    if (targetResult !== null) return;
    target.kill(signal === 'SIGUSR2' ? 'SIGKILL' : signal);
    if (drainDeadlines.kill === null && targetKillTimer === undefined)
      targetKillTimer = setTimeout(
        () => handleSignal('SIGUSR2'),
        Math.max(0, drainDeadlines.term! - Date.now()),
      );
  };
  target.once('error', (error) => {
    startupError = error;
    const errorCode = 'code' in error ? error.code : undefined;
    targetResult = { code: errorCode === 'ENOENT' ? 127 : 125, signal: null };
    resolveTarget();
  });
  target.once('exit', (code, signal) => {
    if (targetResult === null) targetResult = { code, signal };
    resolveTarget();
  });
  if (pendingSignal !== null) handleSignal(pendingSignal);
  await status({ kind: 'ready' });
  if (statusFailure !== null) handleSignal('SIGTERM');
  const proxyPromise = proxyStreams(target, envelope.stdio).then(
    () => null,
    (error: unknown) => {
      handleSignal('SIGTERM');
      return error instanceof Error ? error : new Error(String(error));
    },
  );
  await targetSettled;
  clearTimeout(targetKillTimer);
  const completedTarget = requireTargetResult(targetResult);
  const observedStartupError = startupError;
  if (observedStartupError !== null)
    await status({ kind: 'error', phase: 'startup', message: String(observedStartupError) });
  await status({
    kind: 'target-exit',
    code: completedTarget.code,
    signal: completedTarget.signal,
  });
  let drainError: unknown = null;
  try {
    startSupervisorDrain(drainDeadlines, Date.now());
    await reapSupervisorDescendants(drainDeadlines);
  } catch (error) {
    drainError = error;
    await status({
      kind: 'error',
      phase: 'drain',
      message: error instanceof Error ? error.message : String(error),
    });
  }
  const observedProxyError = await proxyPromise;
  if (observedProxyError !== null) drainError ??= observedProxyError;
  if (observedProxyError !== null)
    await status({ kind: 'error', phase: 'drain', message: observedProxyError.message });
  await status({
    kind: 'complete',
    ok: drainError === null && startupError === null && statusFailure === null,
  });
  await closeStatus();
  if (completedTarget.signal !== null) {
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGUSR2');
    process.kill(process.pid, completedTarget.signal);
  } else
    process.exitCode =
      completedTarget.code === 0 && (drainError !== null || statusFailure !== null)
        ? 1
        : (completedTarget.code ?? 1);
}

if (import.meta.main) void main();
