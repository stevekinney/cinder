import { dlopen, FFIType, ptr, read } from 'bun:ffi';
import { describe, expect, spyOn, test } from 'bun:test';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createInterface } from 'node:readline';
import {
  assertPrctlSuccess,
  enableChildSubreaperWith,
  reapOneChild,
} from './linux-process-supervisor-native.ts';
import {
  decodeLaunchEnvelope as decodeSupervisorEnvelope,
  escalateSupervisorDrain,
  reapSupervisorDescendants,
  startSupervisorDrain,
  supervisorDrainStage,
  type SupervisorDrainDeadlines,
} from './linux-process-supervisor.ts';
import {
  consumeSupervisorFrame,
  finishSupervisorStatus,
  parseSupervisorFrame,
  spawnManagedProcess,
  supervisorState,
  type SupervisorState,
} from './managed-process-spawn.ts';
import { manageChildProcess, terminateChildProcess, waitForExit } from './process-lifecycle.ts';

function childSubreaperState(): number {
  const library = dlopen('libc.so.6', {
    prctl: {
      args: [FFIType.i32, FFIType.ptr, FFIType.i32, FFIType.i32, FFIType.i32],
      returns: FFIType.i32,
    },
  });
  const value = new Int32Array(1);
  const result = library.symbols.prctl(37, ptr(value), 0, 0, 0);
  if (result !== 0) throw new Error(`prctl(PR_GET_CHILD_SUBREAPER) failed: ${result}`);
  return read.i32(ptr(value), 0);
}

function collectStream(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer | string) => chunks.push(Buffer.from(chunk)));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

describe('supervisor termination deadlines', () => {
  const deadlines = (): SupervisorDrainDeadlines => ({ term: null, kill: null });

  test('a late target exit cannot restart the TERM stage', () => {
    const state = deadlines();
    startSupervisorDrain(state, 1_000);
    startSupervisorDrain(state, 5_900);
    expect(supervisorDrainStage(state, 5_900)).toEqual({ signal: 'SIGTERM', deadline: 6_000 });
    expect(supervisorDrainStage(state, 6_000)).toEqual({ signal: 'SIGKILL', deadline: 11_000 });
  });

  test('natural completion gives a stubborn descendant its existing KILL stage', () => {
    const state = deadlines();
    startSupervisorDrain(state, 2_000);
    expect(supervisorDrainStage(state, 7_000)).toEqual({ signal: 'SIGKILL', deadline: 12_000 });
    expect(supervisorDrainStage(state, 13_000)).toEqual({ signal: 'SIGKILL', deadline: 12_000 });
  });

  test('SIGUSR2 advances an active drain without restarting either deadline', () => {
    const state = deadlines();
    startSupervisorDrain(state, 1_000);
    escalateSupervisorDrain(state, 5_000);
    expect(supervisorDrainStage(state, 5_000)).toEqual({ signal: 'SIGKILL', deadline: 10_000 });
    escalateSupervisorDrain(state, 9_000);
    startSupervisorDrain(state, 9_500);
    expect(supervisorDrainStage(state, 9_500)).toEqual({ signal: 'SIGKILL', deadline: 10_000 });
  });

  test('delayed escalation cannot extend a TERM stage that already expired', () => {
    const state = deadlines();
    startSupervisorDrain(state, 1_000);
    escalateSupervisorDrain(state, 8_000);
    expect(supervisorDrainStage(state, 8_000)).toEqual({ signal: 'SIGKILL', deadline: 11_000 });
  });
});

describe('supervisor reaping stages', () => {
  const identity = { pid: 101, parentPid: 100, groupId: 100, startTime: 'birth' };

  test('a late exit and stubborn descendant use one TERM then one KILL stage', async () => {
    const state: SupervisorDrainDeadlines = { term: null, kill: null };
    startSupervisorDrain(state, 1_000);
    let clock = 5_900;
    let alive = true;
    let reaped = false;
    const signals: Array<[string, number]> = [];
    await reapSupervisorDescendants(state, {
      now: () => clock,
      owned: () => (alive ? [identity] : []),
      signal: (_identity, signal) => {
        signals.push([signal, clock]);
        if (signal === 'SIGKILL') alive = false;
      },
      reap: () => {
        if (alive) return { result: 0, errno: 0 };
        if (reaped) return { result: -1, errno: 10 };
        reaped = true;
        return { result: identity.pid, errno: 0 };
      },
      pause: async () => {
        clock += 100;
      },
    });
    expect(signals).toEqual([
      ['SIGTERM', 5_900],
      ['SIGKILL', 6_000],
    ]);
    expect(state.kill).toBe(11_000);
    expect(reaped).toBe(true);
  });

  test('an empty snapshot plus waitpid zero cannot declare cleanup complete', async () => {
    const results = [
      { result: 0, errno: 0 },
      { result: -1, errno: 10 },
    ];
    await reapSupervisorDescendants(
      { term: 5_000, kill: null },
      {
        now: () => 1_000,
        owned: () => [],
        signal: () => {
          throw new Error('unexpected signal');
        },
        reap: () => results.shift()!,
        pause: async () => {},
      },
    );
    expect(results).toHaveLength(0);
  });

  test('waitpid zero through the KILL deadline fails without another wait', async () => {
    let paused = false;
    await expect(
      reapSupervisorDescendants(
        { term: 0, kill: 5_000 },
        {
          now: () => 5_000,
          owned: () => [],
          signal: () => {
            throw new Error('unexpected signal');
          },
          reap: () => ({ result: 0, errno: 0 }),
          pause: async () => {
            paused = true;
          },
        },
      ),
    ).rejects.toThrow('before verified ECHILD');
    expect(paused).toBe(false);
  });
});

describe('managed Linux supervisor', () => {
  test('captures and reaps a grandchild that outlives an immediately exiting target', async () => {
    if (process.platform !== 'linux') return;
    const child = spawnManagedProcess(
      process.execPath,
      [
        '-e',
        "const {spawn}=require('node:child_process'); spawn(process.execPath,['-e','setInterval(()=>{},100000)'],{stdio:'ignore'}); process.exit(23);",
      ],
      { stdio: 'ignore' },
    );
    const [code] = await once(child, 'exit');
    expect(code).toBe(23);
  });

  test('preserves a target signal through the supervisor wrapper', async () => {
    if (process.platform !== 'linux') return;
    const child = spawnManagedProcess(
      process.execPath,
      ['-e', "process.kill(process.pid, 'SIGTERM')"],
      { stdio: 'ignore' },
    );
    await once(child, 'exit');
    expect(child.signalCode).toBe('SIGTERM');
    expect(supervisorState(child)?.complete).toBe(true);
  });

  test('uses the supervisor escalation stage when the target ignores SIGTERM', async () => {
    if (process.platform !== 'linux') return;
    const child = spawnManagedProcess(
      process.execPath,
      ['-e', "process.on('SIGTERM',()=>{}); setInterval(()=>{},100000)"],
      { stdio: 'ignore' },
    );
    await new Promise((resolve) => setTimeout(resolve, 50));
    process.kill(child.pid!, 'SIGUSR2');
    await once(child, 'exit');
    expect(child.exitCode === null && child.signalCode === null).toBe(false);
    const state = supervisorState(child);
    expect(state?.complete).toBe(true);
  });

  test('reports forced wrapper termination without a complete frame', async () => {
    if (process.platform !== 'linux') return;
    const child = spawnManagedProcess(process.execPath, ['-e', 'setTimeout(()=>{},500)'], {
      stdio: 'ignore',
    });
    process.kill(child.pid!, 'SIGKILL');
    await once(child, 'exit');
    const state = supervisorState(child);
    await state?.completion;
    expect(state?.complete).toBe(false);
    expect(state?.error).not.toBeNull();
  });

  test('does not turn the calling process into a subreaper', async () => {
    if (process.platform !== 'linux') return;
    const before = childSubreaperState();
    const child = spawnManagedProcess(process.execPath, ['-e', 'process.exit(0)'], {
      stdio: 'ignore',
    });
    await once(child, 'exit');
    expect(childSubreaperState()).toBe(before);
  });

  test('preserves target stdout and stderr in piped mode', async () => {
    const child = spawnManagedProcess(
      process.execPath,
      ['-e', "process.stdout.write('out'); process.stderr.write('err')"],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const stdout = child.stdout ? collectStream(child.stdout) : Promise.resolve('');
    const stderr = child.stderr ? collectStream(child.stderr) : Promise.resolve('');
    const [code] = await once(child, 'exit');
    expect(code).toBe(0);
    expect(await stdout).toBe('out');
    expect(await stderr).toBe('err');
  });

  test('drains an inherited pipe after the target exits', async () => {
    if (process.platform !== 'linux') return;
    const child = spawnManagedProcess(
      process.execPath,
      [
        '-e',
        "const {spawn}=require('node:child_process'); spawn(process.execPath,['-e','setInterval(()=>{},100000)'],{stdio:['ignore','inherit','inherit']}); process.exit(0);",
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const stdout = child.stdout ? collectStream(child.stdout) : Promise.resolve('');
    const stderr = child.stderr ? collectStream(child.stderr) : Promise.resolve('');
    const [code] = await once(child, 'exit');
    expect(code).toBe(0);
    expect(await stdout).toBe('');
    expect(await stderr).toBe('');
  });

  test('preserves large stdout and stderr streams under backpressure', async () => {
    const child = spawnManagedProcess(
      process.execPath,
      [
        '-e',
        "const chunk='x'.repeat(1024*1024); process.stdout.write(chunk); process.stderr.write(chunk)",
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const stdout = child.stdout ? collectStream(child.stdout) : Promise.resolve('');
    const stderr = child.stderr ? collectStream(child.stderr) : Promise.resolve('');
    const [code] = await once(child, 'exit');
    expect(code).toBe(0);
    const output = await stdout;
    const errorOutput = await stderr;
    expect(output.length).toBe(1024 * 1024);
    expect(errorOutput.length).toBe(1024 * 1024);
  });

  test('flushes large piped output before preserving a target signal', async () => {
    const child = spawnManagedProcess(
      process.execPath,
      [
        '-e',
        "const chunk='x'.repeat(1024*1024); process.stdout.write(chunk,()=>process.stderr.write(chunk,()=>process.kill(process.pid,'SIGTERM')))",
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const stdout = child.stdout ? collectStream(child.stdout) : Promise.resolve('');
    const stderr = child.stderr ? collectStream(child.stderr) : Promise.resolve('');
    await once(child, 'exit');
    const output = await stdout;
    const errorOutput = await stderr;
    expect(child.signalCode).toBe('SIGTERM');
    expect(output.length).toBe(1024 * 1024);
    expect(errorOutput.length).toBe(1024 * 1024);
  });

  test('reports waitpid ECHILD with errno instead of treating it as a child', () => {
    if (process.platform !== 'linux') return;
    const result = reapOneChild();
    expect(result.result).toBe(-1);
    expect(result.errno).toBe(10);
  });

  test('fails closed when the child-subreaper prctl call fails', () => {
    if (process.platform !== 'linux') return;
    expect(() => assertPrctlSuccess(enableChildSubreaperWith(() => -1))).toThrow(
      'PR_SET_CHILD_SUBREAPER',
    );
  });

  test('reaps a detached-session descendant after the target exits', async () => {
    if (process.platform !== 'linux') return;
    const directory = mkdtempSync(`${tmpdir()}/cinder-supervisor-`);
    const pidFile = `${directory}/pid`;
    try {
      const child = spawnManagedProcess(
        process.execPath,
        [
          '-e',
          `const { spawn }=require('node:child_process'); const { writeFileSync }=require('node:fs'); const c=spawn(process.execPath,['-e','setInterval(()=>{},100000)'],{detached:true,stdio:'ignore'}); writeFileSync(${JSON.stringify(pidFile)},String(c.pid)); process.exit(0);`,
        ],
        { stdio: 'ignore' },
      );
      await once(child, 'exit');
      const pid = Number(readFileSync(pidFile, 'utf8'));
      expect(() => process.kill(pid, 0)).toThrow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test('parent cleanup signals only the supervisor ownership boundary', async () => {
    if (process.platform !== 'linux') return;
    const child = spawnManagedProcess(
      process.execPath,
      ['-e', "process.stdout.write(String(process.pid)+'\\n');setInterval(()=>{},100000)"],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const lines = createInterface({ input: child.stdout! });
    const [line] = await once(lines, 'line');
    lines.close();
    const targetPid = Number(line);
    const originalKill = process.kill.bind(process);
    const signaled: number[] = [];
    const kill = spyOn(process, 'kill').mockImplementation((pid, signal) => {
      if (signal !== 0) signaled.push(pid);
      return originalKill(pid, signal);
    });
    try {
      await terminateChildProcess(manageChildProcess(child, 'supervisor ownership fixture', true));
      expect(supervisorState(child)?.complete).toBe(true);
      expect(signaled).not.toContain(targetPid);
    } finally {
      kill.mockRestore();
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
  });

  test('a broken live status pipe still reaps descendants and records reader failure', async () => {
    if (process.platform !== 'linux') return;
    const child = spawnManagedProcess(
      process.execPath,
      [
        '-e',
        `
      const {spawn} = require('node:child_process');
      const descendant = spawn(process.execPath, ['-e', 'setInterval(()=>{},100000)'], {stdio:'ignore'});
      process.on('SIGUSR1', () => process.exit(0));
      process.stdout.write(JSON.stringify({target:process.pid, descendant:descendant.pid})+'\\n');
    `,
      ],
      { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const lines = createInterface({ input: child.stdout! });
    const stderr = collectStream(child.stderr!);
    const [line] = await once(lines, 'line');
    lines.close();
    const owned = JSON.parse(String(line)) as { target: number; descendant: number };
    const failures: unknown[] = [];
    try {
      const exited = once(child, 'exit');
      const statusPipe = child.stdio[3];
      if (statusPipe === null || statusPipe === undefined || !('destroy' in statusPipe))
        throw new Error('expected live status pipe');
      statusPipe.destroy(new Error('injected status reader failure'));
      process.kill(owned.target, 'SIGUSR1');
      await exited;
      await stderr;
      await supervisorState(child)?.completion;
      expect(supervisorState(child)?.error?.message).toContain('injected status reader failure');
      expect(supervisorState(child)?.complete).toBe(false);
      expect(() => process.kill(owned.descendant, 0)).toThrow();
    } catch (error) {
      failures.push(error);
    } finally {
      for (const pid of [owned.target, owned.descendant]) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch (error) {
          if (
            !(
              typeof error === 'object' &&
              error !== null &&
              'code' in error &&
              error.code === 'ESRCH'
            )
          )
            failures.push(error);
        }
      }
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    if (failures.length > 0) throw new AggregateError(failures, 'Status pipe cleanup regression');
  });

  test('a failed supervisor status cannot report target success to its caller', async () => {
    if (process.platform !== 'linux') return;
    const child = spawnManagedProcess(process.execPath, ['-e', 'process.exit(0)'], {
      stdio: 'ignore',
    });
    supervisorState(child)!.error = new Error('injected status failure');
    expect(await waitForExit(child)).toBe(1);
  });

  test('fails finite startup errors without hanging', async () => {
    if (process.platform !== 'linux') return;
    const child = spawnManagedProcess('/definitely/missing/cinder-command', [], {
      stdio: 'ignore',
    });
    const [code] = await once(child, 'exit');
    expect(code).toBe(127);
    expect(supervisorState(child)?.error).not.toBeNull();
  });

  test('rejects unknown envelope keys and relative working directories', () => {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
    expect(() =>
      decodeSupervisorEnvelope(encode({ command: 'bun', args: [], stdio: 'ignore', extra: true })),
    ).toThrow();
    expect(() =>
      decodeSupervisorEnvelope(
        encode({ command: 'bun', args: [], stdio: 'ignore', cwd: 'relative' }),
      ),
    ).toThrow();
    expect(() =>
      decodeSupervisorEnvelope(encode({ command: 'bun', args: [], stdio: 'ignore', cwd: '/tmp' })),
    ).not.toThrow();
  });

  test('rejects malformed supervisor status frames', () => {
    expect(() => parseSupervisorFrame('{"kind":"unknown"}')).toThrow();
    expect(() => parseSupervisorFrame('{"kind":"target-exit","code":256,"signal":null}')).toThrow();
    expect(() => parseSupervisorFrame('{"kind":"complete","ok":"yes"}')).toThrow();
    expect(() =>
      parseSupervisorFrame('{"kind":"target-exit","code":0,"signal":null}'),
    ).not.toThrow();
    expect(() =>
      parseSupervisorFrame('{"kind":"target-exit","code":null,"signal":"SIGTERM"}'),
    ).not.toThrow();
    expect(() =>
      parseSupervisorFrame('{"kind":"target-exit","code":0,"signal":"SIGTERM"}'),
    ).toThrow();
    expect(() =>
      parseSupervisorFrame('{"kind":"target-exit","code":null,"signal":null}'),
    ).toThrow();
  });

  test('rejects live status reordering and early fd3 close', () => {
    const state: SupervisorState = {
      completion: Promise.resolve(),
      error: null,
      ready: false,
      targetExit: null,
      complete: false,
      drainError: null,
    };
    expect(() => consumeSupervisorFrame(state, { kind: 'complete', ok: true })).toThrow();
    consumeSupervisorFrame(state, { kind: 'ready' });
    finishSupervisorStatus(state);
    expect(state.error?.message).toContain('before complete');
    const trailingState: SupervisorState = { ...state, error: null, complete: true };
    finishSupervisorStatus(trailingState, '{"kind":"ready"}');
    expect(trailingState.error?.message).toContain('unterminated frame');
    state.error = null;
    consumeSupervisorFrame(state, { kind: 'target-exit', code: 0, signal: null });
    consumeSupervisorFrame(state, { kind: 'complete', ok: true });
    expect(() =>
      consumeSupervisorFrame(state, { kind: 'error', phase: 'drain', message: 'late' }),
    ).toThrow();
  });
});
