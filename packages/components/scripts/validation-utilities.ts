export const DEFAULT_FILE_SCAN_CONCURRENCY = 24;

/** Narrow unknown JSON-like values to plain object records. */
export function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function mapWithConcurrencyLimit<TValue, TResult>(
  values: TValue[],
  concurrencyLimit: number,
  worker: (value: TValue) => Promise<TResult>,
): Promise<TResult[]> {
  const results = Array.from<TResult>({ length: values.length });
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < values.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await worker(values[currentIndex]!);
    }
  }

  const workerCount = Math.min(Math.max(1, concurrencyLimit), values.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));
  return results;
}
