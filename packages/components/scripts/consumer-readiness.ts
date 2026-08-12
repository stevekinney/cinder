export type RunningServerStatus = {
  exitCode: number | null;
};

export type ReadinessFetch = (url: string, timeoutMs: number) => Promise<Response>;

type WaitForReadyHtmlInput = {
  url: string;
  /** Overall deadline for the route to become ready. */
  timeoutMs: number;
  /**
   * Optional cap on a SINGLE attempt. Defaults to `timeoutMs`, i.e. one slow
   * response may use the entire budget. Only set this when a request that
   * outlives the cap is itself the failure you want to detect — capping below
   * the time the work actually needs makes readiness unreachable, because
   * aborting discards the in-flight render rather than pausing it.
   */
  requestTimeoutMs?: number;
  pollIntervalMs: number;
  runningServer: RunningServerStatus;
  isReady: (html: string) => boolean;
  fetcher?: ReadinessFetch;
};

async function defaultFetch(url: string, timeoutMs: number): Promise<Response> {
  return await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
}

export async function waitForReadyHtml(input: WaitForReadyHtmlInput): Promise<string> {
  const fetcher = input.fetcher ?? defaultFetch;
  // NOTE, deliberately not "fixed" by raising this: each attempt is capped at
  // 5s, and aborting an in-flight request discards the server-side work rather
  // than pausing it. So a response that consistently needs more than 5s can
  // never be observed completing, however large `timeoutMs` is.
  //
  // That is a latent sharp edge, but it is NOT what failed the release on
  // 2026-08-12, and raising this value would be a wait-threshold bump — which
  // AGENTS.md rejects outright, correctly. The measurements are in
  // validate-consumers.ts: aborting PARTIALLY RETAINS Vite's work (a retry after
  // a 300ms abort finished in 0.630s against 1.086s cold), so a merely-slow
  // render recovers across attempts and lands. The failing run made no progress
  // at all across five attempts, which is a wedged server, not a slow one.
  //
  // If a future failure is ever shown to be genuine slowness, fix the slowness.
  const requestTimeoutMs = input.requestTimeoutMs ?? 5_000;
  const startTime = Date.now();
  let lastStatus: number | null = null;
  let lastError: string | null = null;

  while (Date.now() - startTime < input.timeoutMs) {
    if (input.runningServer.exitCode !== null) {
      throw new Error(
        `server exited with code ${input.runningServer.exitCode} before becoming ready at ${input.url}`,
      );
    }

    const elapsedMs = Date.now() - startTime;
    const remainingTimeoutMs = input.timeoutMs - elapsedMs;
    if (remainingTimeoutMs <= 0) break;

    try {
      const response = await fetcher(input.url, Math.min(requestTimeoutMs, remainingTimeoutMs));
      lastStatus = response.status;
      if (response.status === 200) {
        const html = await response.text();
        if (input.isReady(html)) return html;
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await Bun.sleep(input.pollIntervalMs);
  }

  const details =
    lastStatus !== null
      ? `last HTTP status ${lastStatus}`
      : lastError !== null
        ? `last error: ${lastError}`
        : 'no response received';
  throw new Error(`timeout waiting for ready HTML at ${input.url} (${details})`);
}
