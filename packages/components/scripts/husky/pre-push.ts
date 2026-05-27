#!/usr/bin/env bun
import {
  error,
  formatFailureSummary,
  type GateFailure,
  type GateScript,
  header,
  inferFailureScope,
  info,
  installHookProcessCleanup,
  isContinuousIntegration,
  REPO_ROOT,
  success,
  summarizeFailures,
  warning,
  withGateLock,
  writePrePushLog,
} from './utilities.ts';

if (isContinuousIntegration()) {
  info('Skipping hook in CI');
  process.exit(0);
}

installHookProcessCleanup();

header('Pre-push: lint + typecheck + test (working tree)');
warning('Validates the current working tree, not the exact commit range being pushed.');

async function forwardAndCapture(
  stream: ReadableStream<Uint8Array> | null,
  destination: typeof Bun.stdout | typeof Bun.stderr,
  chunks: string[],
): Promise<string> {
  if (!stream) return '';

  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let output = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    output += chunk;
    chunks.push(chunk);
    await Bun.write(destination, value);
  }

  const finalChunk = decoder.decode();
  output += finalChunk;
  if (finalChunk) chunks.push(finalChunk);
  return output;
}

async function runGate(script: GateScript): Promise<{ exitCode: number; output: string }> {
  const chunks: string[] = [];
  const subprocess = Bun.spawn(['bun', 'run', script], {
    cwd: REPO_ROOT,
    stdin: 'inherit',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    forwardAndCapture(subprocess.stdout, Bun.stdout, chunks),
    forwardAndCapture(subprocess.stderr, Bun.stderr, chunks),
    subprocess.exited,
  ]);

  return { exitCode, output: chunks.join('') || stdout + stderr };
}

let ok = false;
let failures: GateFailure[] = [];
let completeOutput = '';

try {
  const result = await withGateLock(async () => {
    // Run lint, typecheck, and test — the three workspace-wide correctness gates.
    // `bun run validate` is intentionally excluded: it builds consumer fixtures
    // (sveltekit-consumer, node-consumer) that require release-ready builds and
    // may fail due to fixture-specific dependency constraints unrelated to code
    // changes. Those checks belong in CI, not the pre-push gate.
    let passed = true;
    const gateFailures: GateFailure[] = [];
    let output = '';
    for (const script of ['lint', 'typecheck', 'test'] as const satisfies readonly GateScript[]) {
      info(`Running ${script}…`);
      let gateResult: { exitCode: number; output: string };
      try {
        gateResult = await runGate(script);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        gateResult = { exitCode: 1, output: `pre-push gate command failed: ${message}` };
      }
      output += `\n\n===== ${script} =====\n\n${gateResult.output}`;
      if (gateResult.exitCode === 0) {
        success(`${script} passed`);
      } else {
        error(`${script} failed`);
        gateFailures.push({
          script,
          scope: inferFailureScope(gateResult.output),
          lines: summarizeFailures(gateResult.output),
        });
        passed = false;
      }
    }
    return { passed, gateFailures, output };
  });
  ok = result.passed;
  failures = result.gateFailures;
  completeOutput = result.output;
} catch (caught) {
  error(caught instanceof Error ? caught.message : String(caught));
  process.exit(1);
}

if (!ok) {
  const logPath = await writePrePushLog(completeOutput);
  for (const line of formatFailureSummary(failures)) {
    error(line);
  }
  error(`Full pre-push output: ${logPath}`);
  error('Pre-push validation failed.');
  error('This hook validates the working tree — uncommitted changes count.');
  error(
    'Run `bun run lint && bun run typecheck && bun run test`, fix the failures, and push again.',
  );
  process.exit(1);
}

success('Pre-push validation passed');
process.exit(0);
