type FetchImplementation = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Install a typed fetch implementation and return its restoration callback. */
export function installFetchImplementation(implementation: FetchImplementation): () => void {
  const original = globalThis.fetch;
  globalThis.fetch = Object.assign(implementation, { preconnect: original.preconnect });
  return () => {
    globalThis.fetch = original;
  };
}
