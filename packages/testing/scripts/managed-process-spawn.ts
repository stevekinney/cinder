import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export type ManagedSpawnStdio = 'inherit' | 'ignore' | ['ignore', 'pipe', 'pipe'];
export type ManagedSpawnOptions = Omit<SpawnOptions, 'stdio'> & { stdio?: ManagedSpawnStdio };

export function forceStopUnverifiedSupervisor(
  childProcess: Pick<ChildProcess, 'kill' | 'pid' | 'exitCode' | 'signalCode'>,
  name: string,
): void {
  if (childProcess.exitCode !== null || childProcess.signalCode !== null) return;
  try {
    childProcess.kill('SIGKILL');
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code !== 'ESRCH') console.error(`Failed to force-stop ${name}:`, error);
  }
}

export type SupervisorFrame =
  | { kind: 'ready' }
  | { kind: 'target-exit'; code: number | null; signal: string | null }
  | { kind: 'complete'; ok: boolean }
  | { kind: 'error'; phase: 'startup' | 'drain'; message: string };

export type SupervisorState = {
  readonly completion: Promise<void>;
  error: Error | null;
  ready: boolean;
  targetExit: SupervisorFrame | null;
  complete: boolean;
  drainError: Error | null;
};

const states = new WeakMap<ChildProcess, SupervisorState>();
const supervisorEntry = fileURLToPath(new URL('./linux-process-supervisor.ts', import.meta.url));
const signalNames = new Set([
  'SIGABRT',
  'SIGALRM',
  'SIGBUS',
  'SIGCHLD',
  'SIGCONT',
  'SIGFPE',
  'SIGHUP',
  'SIGILL',
  'SIGINT',
  'SIGIO',
  'SIGIOT',
  'SIGKILL',
  'SIGPIPE',
  'SIGPOLL',
  'SIGPROF',
  'SIGPWR',
  'SIGQUIT',
  'SIGSEGV',
  'SIGSTKFLT',
  'SIGSTOP',
  'SIGSYS',
  'SIGTERM',
  'SIGTRAP',
  'SIGTSTP',
  'SIGTTIN',
  'SIGTTOU',
  'SIGURG',
  'SIGUSR1',
  'SIGUSR2',
  'SIGVTALRM',
  'SIGWINCH',
  'SIGXCPU',
  'SIGXFSZ',
]);

function isSupervisorStdio(value: unknown): value is ManagedSpawnStdio {
  return (
    value === 'inherit' ||
    value === 'ignore' ||
    (Array.isArray(value) &&
      value.length === 3 &&
      value[0] === 'ignore' &&
      value[1] === 'pipe' &&
      value[2] === 'pipe')
  );
}
function outerStdio(stdio: ManagedSpawnStdio): SpawnOptions['stdio'] {
  if (stdio === 'inherit') return ['inherit', 'inherit', 'inherit', 'pipe'];
  if (stdio === 'ignore') return ['ignore', 'ignore', 'ignore', 'pipe'];
  return ['ignore', 'pipe', 'pipe', 'pipe'];
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
export function parseSupervisorFrame(value: string): SupervisorFrame {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed) || typeof parsed['kind'] !== 'string')
    throw new Error('invalid supervisor status frame');
  const kind = parsed['kind'];
  if (kind === 'ready') return { kind };
  if (kind === 'target-exit') {
    const code = parsed['code'];
    const signal = parsed['signal'];
    if (
      (typeof code !== 'number' && code !== null) ||
      (typeof code === 'number' && (!Number.isInteger(code) || code < 0 || code > 255)) ||
      (typeof signal !== 'string' && signal !== null) ||
      (typeof signal === 'string' && !signalNames.has(signal)) ||
      (code === null) === (signal === null)
    )
      throw new Error('invalid supervisor target-exit frame');
    return { kind, code, signal };
  }
  if (kind === 'complete') {
    if (typeof parsed['ok'] !== 'boolean') throw new Error('invalid supervisor complete frame');
    return { kind, ok: parsed['ok'] };
  }
  if (kind === 'error') {
    const phase = parsed['phase'];
    const message = parsed['message'];
    if ((phase !== 'startup' && phase !== 'drain') || typeof message !== 'string')
      throw new Error('invalid supervisor error frame');
    return { kind, phase, message };
  }
  throw new Error('unknown supervisor status frame');
}

export function consumeSupervisorFrame(state: SupervisorState, frame: SupervisorFrame): void {
  if (state.complete) throw new Error('supervisor status frame arrived after complete');
  if (frame.kind === 'ready') {
    if (state.ready) throw new Error('duplicate supervisor ready frame');
    state.ready = true;
  } else if (frame.kind === 'target-exit') {
    if (!state.ready || state.targetExit !== null)
      throw new Error('out-of-order supervisor target-exit frame');
    state.targetExit = frame;
  } else if (frame.kind === 'complete') {
    if (state.targetExit === null || state.complete)
      throw new Error('out-of-order supervisor complete frame');
    state.complete = true;
    if (!frame.ok && state.error === null) state.error = new Error('supervisor drain failed');
  } else {
    const error = new Error(frame.message);
    state.error = error;
    if (frame.phase === 'drain') state.drainError = error;
  }
}

export function finishSupervisorStatus(state: SupervisorState, trailingBytes = ''): void {
  if (trailingBytes.length > 0 && state.error === null)
    state.error = new Error('supervisor status ended with unterminated frame');
  if (!state.complete && state.error === null)
    state.error = new Error('supervisor status ended before complete frame');
}

function attachState(child: ChildProcess): void {
  const stream = child.stdio[3];
  if (stream === undefined || stream === null || typeof stream.on !== 'function')
    throw new Error('supervisor status pipe unavailable');
  let resolveCompletion!: () => void;
  const completion = new Promise<void>((resolve) => {
    resolveCompletion = resolve;
  });
  const state: SupervisorState = {
    completion,
    error: null,
    ready: false,
    targetExit: null,
    complete: false,
    drainError: null,
  };
  states.set(child, state);
  if (stream === undefined || stream === null)
    throw new Error('supervisor status pipe unavailable');
  let buffer = '';
  stream.on('data', (chunk: Buffer | string) => {
    buffer += chunk.toString();
    while (buffer.includes('\n')) {
      const index = buffer.indexOf('\n');
      const line = buffer.slice(0, index);
      buffer = buffer.slice(index + 1);
      if (line.length === 0) continue;
      try {
        consumeSupervisorFrame(state, parseSupervisorFrame(line));
      } catch (error) {
        state.error = error instanceof Error ? error : new Error(String(error));
      }
    }
  });
  stream.once('close', () => {
    finishSupervisorStatus(state, buffer);
    resolveCompletion();
  });
  stream.once('error', (error) => {
    state.error ??= error instanceof Error ? error : new Error(String(error));
    resolveCompletion();
  });
  child.once('error', (error) => {
    state.error ??= error;
    resolveCompletion();
  });
}

export function spawnManagedProcess(
  command: string,
  args: readonly string[],
  options: ManagedSpawnOptions = {},
): ChildProcess {
  const stdio = options.stdio ?? 'inherit';
  if (process.platform !== 'linux') return spawn(command, args, options);
  if (!isSupervisorStdio(stdio)) throw new Error('unsupported managed process stdio');
  const envelope = Buffer.from(
    JSON.stringify({
      command,
      args: [...args],
      ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      stdio,
    }),
  ).toString('base64url');
  const child = spawn(process.execPath, [supervisorEntry], {
    ...options,
    stdio: outerStdio(stdio),
    env: { ...process.env, ...options.env, CINDER_LINUX_SUPERVISOR_ENVELOPE: envelope },
  });
  attachState(child);
  return child;
}

export function supervisorState(child: ChildProcess): SupervisorState | undefined {
  return states.get(child);
}

export function requestSupervisorKill(child: ChildProcess): boolean {
  if (process.platform !== 'linux' || states.get(child) === undefined || child.pid === undefined)
    return false;
  try {
    process.kill(child.pid, 'SIGUSR2');
    return true;
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    if (code === 'ESRCH') return false;
    throw error;
  }
}
