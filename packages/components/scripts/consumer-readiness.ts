export type RunningServerStatus = {
  exitCode: number | null;
};

export type ReadinessFetch = (url: string, timeoutMs: number) => Promise<Response>;

type WaitForReadyHtmlInput = {
  url: string;
  timeoutMs: number;
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
      const response = await fetcher(input.url, remainingTimeoutMs);
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
