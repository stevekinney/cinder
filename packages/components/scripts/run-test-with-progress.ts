import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDirectory, '..');

const DEFAULT_TEST_ARGUMENTS = [
  'test',
  '--conditions',
  'browser',
  '--conditions',
  'svelte',
  '--parallel=1',
] as const;

const DEFAULT_HEARTBEAT_MILLISECONDS = 30_000;

type ProgressSignal = 'SIGHUP' | 'SIGINT' | 'SIGTERM';

const SIGNAL_EXIT_CODES: Record<ProgressSignal, number> = {
  SIGHUP: 129,
  SIGINT: 130,
  SIGTERM: 143,
};

export type ProgressRunnerOptions = {
  readonly forwardedArguments: readonly string[];
  readonly heartbeatMilliseconds?: number;
};

type TestSpawnOptions = {
  readonly cwd: string;
  readonly detached: true;
  readonly env: Record<string, string | undefined>;
  readonly stderr: 'inherit';
  readonly stdin: 'ignore';
  readonly stdout: 'inherit';
};

type RunningChildProcess = Pick<ReturnType<typeof Bun.spawn>, 'exited' | 'pid'>;

export type ProgressRunnerDependencies = {
  readonly clearInterval: (timer: ReturnType<typeof setInterval>) => void;
  readonly now: () => number;
  readonly setInterval: (
    callback: () => void,
    milliseconds: number,
  ) => ReturnType<typeof setInterval>;
  readonly spawn: (command: string[], options: TestSpawnOptions) => RunningChildProcess;
  readonly write: (message: string) => void;
};

const defaultDependencies: ProgressRunnerDependencies = {
  clearInterval,
  now: Date.now,
  setInterval,
  spawn: (command, options) => Bun.spawn(command, options),
  write: (message) => process.stderr.write(message),
};

function elapsedSeconds(startedAtMilliseconds: number, nowMilliseconds: number): number {
  return Math.floor((nowMilliseconds - startedAtMilliseconds) / 1000);
}

function shellQuote(argument: string): string {
  if (/^[\w./:=@+-]+$/.test(argument)) return argument;
  return `'${argument.replaceAll("'", "'\\''")}'`;
}

export function buildBunTestArguments(forwardedArguments: readonly string[]): string[] {
  return [...DEFAULT_TEST_ARGUMENTS, ...forwardedArguments];
}

export function formatProgressCommand(command: string, arguments_: readonly string[]): string {
  return [command, ...arguments_].map(shellQuote).join(' ');
}

export function formatHeartbeatMessage(
  commandLabel: string,
  startedAtMilliseconds: number,
  nowMilliseconds: number,
): string {
  return `[test-progress] ${commandLabel} still running after ${elapsedSeconds(startedAtMilliseconds, nowMilliseconds)}s\n`;
}

export function formatExitMessage(
  commandLabel: string,
  startedAtMilliseconds: number,
  nowMilliseconds: number,
  exitCode: number,
): string {
  const status = exitCode === 0 ? 'completed' : `failed with exit ${exitCode}`;
  return `[test-progress] ${commandLabel} ${status} after ${elapsedSeconds(startedAtMilliseconds, nowMilliseconds)}s\n`;
}

function signalProcessGroup(pid: number, signal: ProgressSignal): void {
  try {
    process.kill(-pid, signal);
    return;
  } catch {
    // Fall back to the direct child when process-group signaling is unavailable.
  }

  try {
    process.kill(pid, signal);
  } catch {
    // The child may already have exited.
  }
}

export async function runTestWithProgress(
  options: ProgressRunnerOptions,
  dependencies: ProgressRunnerDependencies = defaultDependencies,
): Promise<number> {
  const heartbeatMilliseconds = options.heartbeatMilliseconds ?? DEFAULT_HEARTBEAT_MILLISECONDS;
  const testArguments = buildBunTestArguments(options.forwardedArguments);
  const commandLabel = formatProgressCommand('bun', testArguments);
  const startedAtMilliseconds = dependencies.now();

  dependencies.write(`[test-progress] starting ${commandLabel}\n`);

  const child = dependencies.spawn(['bun', ...testArguments], {
    cwd: packageRoot,
    detached: true,
    env: { ...Bun.env, LANG: 'en_US.UTF-8', TZ: 'UTC' },
    stderr: 'inherit',
    stdin: 'ignore',
    stdout: 'inherit',
  });

  const timer = dependencies.setInterval(() => {
    dependencies.write(
      formatHeartbeatMessage(commandLabel, startedAtMilliseconds, dependencies.now()),
    );
  }, heartbeatMilliseconds);

  try {
    const exitCode = (await child.exited) ?? 1;
    dependencies.write(
      formatExitMessage(commandLabel, startedAtMilliseconds, dependencies.now(), exitCode),
    );
    return exitCode;
  } finally {
    dependencies.clearInterval(timer);
  }
}

async function main(): Promise<void> {
  let childProcess: RunningChildProcess | undefined;
  const dependencies: ProgressRunnerDependencies = {
    ...defaultDependencies,
    spawn: (command, options) => {
      childProcess = Bun.spawn(command, options);
      return childProcess;
    },
  };

  for (const signal of ['SIGHUP', 'SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      if (childProcess) {
        signalProcessGroup(childProcess.pid, signal);
      }
      process.exit(SIGNAL_EXIT_CODES[signal]);
    });
  }

  const exitCode = await runTestWithProgress(
    { forwardedArguments: process.argv.slice(2) },
    dependencies,
  );
  process.exit(exitCode);
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error('run-test-with-progress failed:', error);
    process.exit(1);
  });
}
