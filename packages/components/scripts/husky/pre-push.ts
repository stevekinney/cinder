#!/usr/bin/env bun
import {
  error,
  formatFailureSummary,
  type GateFailure,
  type GateScript,
  header,
  inferFailureScope,
  info,
  isContinuousIntegration,
  REPO_ROOT,
  success,
  summarizeFailures,
  warning,
  writePrePushLog,
} from './utilities.ts';

if (isContinuousIntegration()) {
  info('Skipping hook in CI');
  process.exit(0);
}

header('Pre-push: lint + typecheck + test (working tree)');
warning('Validates the current working tree, not the exact commit range being pushed.');

async function forwardAndCapture(
  stream: ReadableStream<Uint8Array> | null,
  destination: typeof Bun.stdout | typeof Bun.stderr,
): Promise<string> {
  if (!stream) return '';

  const decoder = new TextDecoder();
  const reader = stream.getReader();
  let output = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    output += decoder.decode(value, { stream: true });
    await Bun.write(destination, value);
  }

  output += decoder.decode();
  return output;
}

async function runGate(script: GateScript): Promise<{ exitCode: number; output: string }> {
  const subprocess = Bun.spawn(['bun', 'run', script], {
    cwd: REPO_ROOT,
    stdin: 'inherit',
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    forwardAndCapture(subprocess.stdout, Bun.stdout),
    forwardAndCapture(subprocess.stderr, Bun.stderr),
    subprocess.exited,
  ]);

  return { exitCode, output: stdout + stderr };
}

// Run lint, typecheck, and test — the three workspace-wide correctness gates.
// `bun run validate` is intentionally excluded: it builds consumer fixtures
// (sveltekit-consumer, node-consumer) that require release-ready builds and
// may fail due to fixture-specific dependency constraints unrelated to code
// changes. Those checks belong in CI, not the pre-push gate.
let ok = true;
const failures: GateFailure[] = [];
let completeOutput = '';
for (const script of ['lint', 'typecheck', 'test'] as const satisfies readonly GateScript[]) {
  info(`Running ${script}…`);
  const result = await runGate(script);
  completeOutput += `\n\n===== ${script} =====\n\n${result.output}`;
  if (result.exitCode === 0) {
    success(`${script} passed`);
  } else {
    error(`${script} failed`);
    failures.push({
      script,
      scope: inferFailureScope(result.output),
      lines: summarizeFailures(result.output),
    });
    ok = false;
  }
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
