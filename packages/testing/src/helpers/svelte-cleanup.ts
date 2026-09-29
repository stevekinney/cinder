let registered = false;

/** Register the runner's cleanup hook after DOM globals are installed. */
export async function registerGlobalCleanup(
  registerAfterEach: (cleanup: () => void) => void,
): Promise<void> {
  if (registered) return;
  const { cleanup } = await import('@testing-library/svelte');
  registerAfterEach(cleanup);
  registered = true;
}
