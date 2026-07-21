/**
 * Tiny reactive log used by `chat-adapter.test.ts` to prove the workaround
 * documented on `ChatAdapter.subscribe`: deferring a `$state` write
 * performed inside `subscribe` avoids re-entering Svelte's effect flush. A
 * plain array wouldn't exercise anything real — the hazard is specifically
 * about `$state` — but proving it doesn't require a dedicated `.svelte`
 * fixture component (and the render tree that comes with mounting one).
 */
export class SubscribeEventLog {
  #entries = $state<string[]>([]);

  get entries(): string[] {
    return this.#entries;
  }

  push(entry: string): void {
    this.#entries = [...this.#entries, entry];
  }
}
