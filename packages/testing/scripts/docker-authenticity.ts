import { existsSync, readFileSync } from 'node:fs';
import { REQUIRED_BASELINE_ARCHITECTURE } from './baseline-provenance.ts';

export type AuthenticityFailure = {
  check: string;
  expected: string;
  actual: string;
};

export type AuthenticityResult =
  | { ok: true; playwrightVersion: string }
  | { ok: false; failures: AuthenticityFailure[] };

function readPinnedPlaywrightVersion(packageJsonPath: string): string {
  const raw = readFileSync(packageJsonPath, 'utf8');
  const parsed = JSON.parse(raw) as { devDependencies?: Record<string, string> };
  const pinned = parsed.devDependencies?.['@playwright/test'];
  if (!pinned) {
    throw new Error(`@playwright/test is not declared in ${packageJsonPath}`);
  }
  if (/^[\^~]/.test(pinned)) {
    throw new Error(
      `@playwright/test must be exact-pinned (no ^ or ~) in ${packageJsonPath}; got "${pinned}"`,
    );
  }
  return pinned;
}

function readOsReleaseId(): string | undefined {
  if (!existsSync('/etc/os-release')) return undefined;
  const raw = readFileSync('/etc/os-release', 'utf8');
  const match = /^VERSION_CODENAME=(.+)$/m.exec(raw);
  return match?.[1]?.replace(/['"]/g, '').trim();
}

async function readInstalledPlaywrightVersion(): Promise<string | undefined> {
  try {
    const proc = Bun.spawn(['playwright', '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const exit = await proc.exited;
    if (exit !== 0) return undefined;
    const output = await new Response(proc.stdout).text();
    // Output format: "Version 1.60.0"
    const match = /Version\s+(\S+)/i.exec(output);
    return match?.[1];
  } catch {
    // ENOENT etc. — playwright binary is not on PATH (typical on a dev host
    // without `bunx playwright install`). Treat as missing rather than
    // crashing the authenticity check.
    return undefined;
  }
}

/**
 * Checks 1-3 below all still pass on an arm64 build of the canonical image:
 * the `mcr.microsoft.com/playwright` base is multi-arch, so an image built
 * without `--platform` on an Apple Silicon Docker host reports the same
 * Ubuntu codename, the same installed Playwright version, and the same baked
 * `CINDER_PLAYWRIGHT_VERSION` as the amd64 image CI uses — yet its rasterizer
 * differs from every committed baseline PNG. The container's runtime
 * `process.arch` proves which image architecture was selected; the host-side
 * wrapper separately checks Docker's daemon architecture before building.
 */
export function architectureAuthenticityFailure(
  containerArchitecture: string,
): AuthenticityFailure | undefined {
  if (containerArchitecture === REQUIRED_BASELINE_ARCHITECTURE) return undefined;
  return {
    check: 'container architecture',
    expected: REQUIRED_BASELINE_ARCHITECTURE,
    actual: containerArchitecture,
  };
}

export async function checkDockerAuthenticity(
  packageJsonPath: string,
  containerArchitecture: string = process.arch,
): Promise<AuthenticityResult> {
  const failures: AuthenticityFailure[] = [];
  const pinned = readPinnedPlaywrightVersion(packageJsonPath);

  // Check 1: OS is Ubuntu jammy (22.04). This is the canonical Playwright image base.
  const codename = readOsReleaseId();
  if (codename !== 'jammy') {
    failures.push({
      check: 'os-release VERSION_CODENAME',
      expected: 'jammy',
      actual: codename ?? '<missing /etc/os-release>',
    });
  }

  // Check 2: installed Playwright matches the package.json pin.
  const installed = await readInstalledPlaywrightVersion();
  if (installed !== pinned) {
    failures.push({
      check: 'playwright --version vs package.json pin',
      expected: pinned,
      actual: installed ?? '<playwright not found>',
    });
  }

  // Check 3: CINDER_PLAYWRIGHT_VERSION env was baked into the image at build,
  // and it matches the pin. This proves the running container was built from
  // *this* repo's Dockerfile, not an arbitrary container the user set
  // PLAYWRIGHT_DOCKER=1 inside.
  const baked = process.env['CINDER_PLAYWRIGHT_VERSION'];
  if (baked !== pinned) {
    failures.push({
      check: 'CINDER_PLAYWRIGHT_VERSION baked at image build',
      expected: pinned,
      actual: baked ?? '<env var unset — likely not inside the cinder-playwright image>',
    });
  }

  // Check 4: the container's own architecture matches every committed
  // baseline. See architectureAuthenticityFailure's doc comment for why this
  // cannot be inferred from checks 1-3.
  const architectureFailure = architectureAuthenticityFailure(containerArchitecture);
  if (architectureFailure) failures.push(architectureFailure);

  if (failures.length > 0) return { ok: false, failures };
  return { ok: true, playwrightVersion: pinned };
}

export function formatFailures(failures: AuthenticityFailure[]): string {
  const lines: string[] = [
    'Refusing to update snapshots: this process is not running inside the canonical cinder-playwright Docker image.',
    '',
    'Failed checks:',
  ];
  for (const failure of failures) {
    lines.push(
      `  - ${failure.check}`,
      `      expected: ${failure.expected}`,
      `      actual:   ${failure.actual}`,
    );
  }
  lines.push('');
  if (failures.some((failure) => failure.check === 'container architecture')) {
    // Re-running test:browser:update:docker here would just rebuild the same
    // mismatched-architecture image again — that is not the fix.
    lines.push(
      'This image was built for the wrong architecture (the Docker wrapper does not pin --platform,',
      'so it silently built for the daemon architecture instead of the amd64 architecture every committed',
      'baseline was captured on). Re-running test:browser:update:docker here reproduces the same',
      'mismatch — use the supported CI route instead:',
      '  gh workflow run browser-tests.yaml -f update_baselines=true -f source_ref=<branch> -f base_ref=main',
      '(update-baselines is a job inside browser-tests.yaml, not its own workflow file.)',
    );
  } else {
    lines.push(
      'macOS / Linux dev hosts cannot author baselines — pixel rendering differs from CI.',
      'Run "bun run --filter=@cinder/testing test:browser:update:docker" instead.',
    );
  }
  return lines.join('\n');
}
