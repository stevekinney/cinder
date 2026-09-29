export type HistoryFlushResult = {
  failed: boolean;
  error: unknown;
};

export function flushHistory(flushSync: () => void): HistoryFlushResult {
  try {
    flushSync();
    return { failed: false, error: undefined };
  } catch (error) {
    return { failed: true, error };
  }
}

export async function observeHistoryLoading<T>(
  loading: Promise<T>,
  flush: HistoryFlushResult,
): Promise<T> {
  try {
    return await loading;
  } catch (error) {
    if (flush.failed) throw flush.error;
    throw error;
  }
}
