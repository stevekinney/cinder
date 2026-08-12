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
  // Default a single attempt to the WHOLE readiness budget.
  //
  // This used to default to 5s, which quietly made the loop unable to wait for
  // anything slower than 5s no matter how large `timeoutMs` was: each attempt
  // aborted at 5s, and aborting an in-flight SSR request throws away the render
  // it was waiting on, so the next attempt started from scratch and hit the same
  // wall. A cold `vite dev` server rendering a route through hundreds of
  // unbundled transform-on-request modules legitimately exceeds 5s, so the poll
  // loop cancelled the very work it was polling for until the budget expired —
  // failing with `last error: The operation timed out.` while the server was
  // healthy and still working.
  //
  // A per-request cap is still available to callers that genuinely want to bound
  // individual attempts (a hung socket that never responds); it is just no
  // longer imposed on callers that only want an overall deadline.
  const requestTimeoutMs = input.requestTimeoutMs ?? input.timeoutMs;
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
