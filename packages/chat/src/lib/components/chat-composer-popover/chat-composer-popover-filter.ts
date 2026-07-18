export type FuzzyFilterItem = {
  value: string;
  label: string;
  keywords?: readonly string[] | undefined;
};

export type FuzzyFilterResult<TItem extends FuzzyFilterItem> = {
  item: TItem;
  score: number;
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function fuzzySubsequenceScore(candidate: string, query: string): number | null {
  const normalizedCandidate = normalize(candidate);
  const normalizedQuery = normalize(query);

  if (normalizedQuery.length === 0) return 0;
  if (normalizedCandidate.length === 0) return null;

  let score = 0;
  let searchIndex = 0;
  let previousMatchIndex = -1;

  for (const character of normalizedQuery) {
    const matchIndex = normalizedCandidate.indexOf(character, searchIndex);
    if (matchIndex === -1) return null;

    score += matchIndex === previousMatchIndex + 1 ? 4 : 1;
    if (matchIndex === 0) score += 2;
    if (/[\s/_-]/u.test(normalizedCandidate[matchIndex - 1] ?? '')) score += 2;

    previousMatchIndex = matchIndex;
    searchIndex = matchIndex + 1;
  }

  return score - normalizedCandidate.length * 0.01;
}

export function filterFuzzySubsequence<TItem extends FuzzyFilterItem>(
  items: readonly TItem[],
  query: string,
): TItem[] {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length === 0) return [...items];

  const matchedItems = items
    .map((item, index) => {
      const candidates = [item.label, item.value, ...(item.keywords ?? [])];
      let bestScore: number | null = null;

      for (const candidate of candidates) {
        const score = fuzzySubsequenceScore(candidate, normalizedQuery);
        if (score !== null && (bestScore === null || score > bestScore)) {
          bestScore = score;
        }
      }

      return bestScore === null ? null : { item, index, score: bestScore };
    })
    .filter((result) => result !== null);

  matchedItems.sort((a, b) => b.score - a.score || a.index - b.index);

  return matchedItems.map((result) => result.item);
}
