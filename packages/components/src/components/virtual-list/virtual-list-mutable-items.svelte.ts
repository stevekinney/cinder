/**
 * A `$state`-backed items array for scroll-restoration tests that need to
 * mutate an EXISTING array in place — replacing a row without changing the
 * count — the same shape of change a consumer's own `$state` array produces.
 *
 * A plain test array cannot simulate that: reassigning `items = [...]` (even
 * to a same-length replacement) gives VirtualList a new array reference, which
 * its own `items !== previousItems` check already detects. The defect this
 * covers is specifically an in-place write that changes neither the
 * reference nor the length — which only a genuinely reactive array can
 * produce, hence this file needing the `.svelte.ts` extension for rune
 * support.
 */
export function createMutableItems<Item>(initial: readonly Item[]): {
  readonly items: Item[];
  replaceAt(index: number, item: Item): void;
} {
  const items = $state<Item[]>([...initial]);
  return {
    get items(): Item[] {
      return items;
    },
    replaceAt(index: number, item: Item): void {
      items[index] = item;
    },
  };
}
