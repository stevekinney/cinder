/** Shared I/O primitives injected into orchestration logic. Tests replace these with fakes. */

const colorsEnabled = process.stderr.isTTY && !process.env['NO_COLOR'];
const reset = '\x1b[0m';

function paint(hex: string, text: string): string {
  if (!colorsEnabled) return text;
  const ansi = Bun.color(hex, 'ansi');
  return ansi ? `${ansi}${text}${reset}` : text;
}

const levelColors: Record<LogLevel, string> = {
  INFO: '#94a3b8',
  PHASE: '#38bdf8',
  OK: '#22c55e',
  WARN: '#fbbf24',
  ERROR: '#ef4444',
};

export type LogLevel = 'INFO' | 'PHASE' | 'OK' | 'WARN' | 'ERROR';

export type RunOptions = {
  cwd?: string;
  stdin?: string;
  env?: Record<string, string>;
  tee?: boolean;
  timeoutMs?: number;
};

export type RunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export type StreamResult = {
  exitCode: number;
  captured: string;
  timedOut: boolean;
};

export type StreamOptions = RunOptions & { logPath?: string };

/** Injectable I/O surface. Production uses `realDeps`; tests inject a fake. */
export type Deps = {
  run(args: string[], options?: RunOptions): Promise<RunResult>;
  runOk(args: string[], options?: RunOptions): Promise<string>;
  runStreaming(args: string[], options: StreamOptions): Promise<StreamResult>;
  log(level: LogLevel, message: string): void;
  now(): Date;
  sleep(ms: number): Promise<void>;
  writeFile(path: string, content: string): Promise<void>;
};

// ---------------------------------------------------------------------------
// Active children — shared so the SIGINT handler can kill them all.
// ---------------------------------------------------------------------------

const activeChildren = new Set<ReturnType<typeof Bun.spawn>>();

process.once('SIGINT', () => killChildren('SIGINT'));
process.once('SIGTERM', () => killChildren('SIGTERM'));

function killChildren(signal: string): void {
  for (const child of activeChildren) {
    try {
      child.kill();
    } catch {
      // already dead
    }
  }
  process.stderr.write(`\n[triage] ${signal} received — child processes killed.\n`);
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function run(args: string[], options: RunOptions = {}): Promise<RunResult> {
  const child = Bun.spawn(args, {
    cwd: options.cwd ?? process.cwd(),
    stdin: options.stdin === undefined ? 'ignore' : 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    env: options.env ?? process.env,
  });
  activeChildren.add(child);

  if (options.stdin !== undefined && child.stdin) {
    child.stdin.write(options.stdin);
    await child.stdin.end();
  }

  const decoderOut = new TextDecoder();
  const decoderErr = new TextDecoder();
  let stdout = '';
  let stderr = '';

  const drainOut = (async () => {
    for await (const chunk of child.stdout) {
      const text = decoderOut.decode(chunk, { stream: true });
      if (options.tee) process.stderr.write(text);
      stdout += text;
    }
    stdout += decoderOut.decode();
  })();

  const drainErr = (async () => {
    for await (const chunk of child.stderr) {
      const text = decoderErr.decode(chunk, { stream: true });
      if (options.tee) process.stderr.write(text);
      stderr += text;
    }
    stderr += decoderErr.decode();
  })();

  try {
    if (options.timeoutMs !== undefined) {
      const timeout = options.timeoutMs;
      const timedOut = await Promise.race([
        Promise.all([drainOut, drainErr, child.exited]).then(() => false),
        Bun.sleep(timeout).then(() => true),
      ]);
      if (timedOut) {
        try {
          child.kill();
        } catch {
          // already exited
        }
        await Promise.allSettled([drainOut, drainErr]);
        activeChildren.delete(child);
        return { exitCode: -1, stdout, stderr, timedOut: true };
      }
      const exitCode = await child.exited;
      activeChildren.delete(child);
      return { exitCode, stdout, stderr, timedOut: false };
    }

    await Promise.all([drainOut, drainErr]);
    const exitCode = await child.exited;
    activeChildren.delete(child);
    return { exitCode, stdout, stderr, timedOut: false };
  } catch (error) {
    activeChildren.delete(child);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// runOk
// ---------------------------------------------------------------------------

async function runOk(args: string[], options: RunOptions = {}): Promise<string> {
  const result = await run(args, options);
  if (result.timedOut) {
    throw new Error(`Command timed out: ${args.join(' ')}`);
  }
  if (result.exitCode !== 0) {
    const detail = result.stderr.trim() || result.stdout.trim() || `exit ${result.exitCode}`;
    throw new Error(`Command failed: ${args.join(' ')}\n${detail}`);
  }
  return result.stdout;
}

// ---------------------------------------------------------------------------
// runStreaming
// ---------------------------------------------------------------------------

async function runStreaming(args: string[], options: StreamOptions = {}): Promise<StreamResult> {
  const child = Bun.spawn(args, {
    cwd: options.cwd ?? process.cwd(),
    stdin: options.stdin === undefined ? 'ignore' : 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
    env: options.env ?? process.env,
  });
  activeChildren.add(child);

  if (options.stdin !== undefined && child.stdin) {
    child.stdin.write(options.stdin);
    await child.stdin.end();
  }

  const decoderOut = new TextDecoder();
  const decoderErr = new TextDecoder();
  let captured = '';
  const logChunks: string[] = [];

  const drainOut = (async () => {
    for await (const chunk of child.stdout) {
      const text = decoderOut.decode(chunk, { stream: true });
      process.stderr.write(text);
      captured += text;
      if (options.logPath) logChunks.push(text);
    }
    const tail = decoderOut.decode();
    captured += tail;
    if (options.logPath && tail) logChunks.push(tail);
  })();

  const drainErr = (async () => {
    for await (const chunk of child.stderr) {
      process.stderr.write(decoderErr.decode(chunk, { stream: true }));
    }
  })();

  const finalize = async (timedOut: boolean): Promise<StreamResult> => {
    if (options.logPath && logChunks.length > 0) {
      await Bun.write(options.logPath, logChunks.join(''));
    }
    activeChildren.delete(child);
    if (timedOut) {
      return { exitCode: -1, captured, timedOut: true };
    }
    const exitCode = await child.exited;
    return { exitCode, captured, timedOut: false };
  };

  try {
    if (options.timeoutMs !== undefined) {
      const timeout = options.timeoutMs;
      const timedOut = await Promise.race([
        Promise.all([drainOut, drainErr, child.exited]).then(() => false),
        Bun.sleep(timeout).then(() => true),
      ]);
      if (timedOut) {
        try {
          child.kill();
        } catch {
          // already exited
        }
        await Promise.allSettled([drainOut, drainErr]);
        return finalize(true);
      }
      await Promise.all([drainOut, drainErr]);
      return finalize(false);
    }

    await Promise.all([drainOut, drainErr]);
    return finalize(false);
  } catch (error) {
    activeChildren.delete(child);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// log
// ---------------------------------------------------------------------------

function log(level: LogLevel, message: string): void {
  const timestamp = new Date().toISOString().slice(11, 19);
  const stamp = paint('#94a3b8', `[${timestamp}]`);
  const tag = paint(levelColors[level], `[${level}]`);
  process.stderr.write(`${stamp} ${tag} ${message}\n`);
}

// ---------------------------------------------------------------------------
// realDeps
// ---------------------------------------------------------------------------

export const realDeps: Deps = {
  run,
  runOk,
  runStreaming,
  log,
  now: () => new Date(),
  sleep: (ms) => Bun.sleep(ms),
  writeFile: (path, content) => Bun.write(path, content).then(() => undefined),
};
