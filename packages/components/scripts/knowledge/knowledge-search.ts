export function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function tokenize(value: string): string[] {
  return normalize(value)
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 0);
}

export function levenshtein(left: string, right: string): number {
  const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
  for (let column = 1; column <= right.length; column += 1) rows[0]![column] = column;

  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row]![column] = Math.min(
        rows[row - 1]![column]! + 1,
        rows[row]![column - 1]! + 1,
        rows[row - 1]![column - 1]! + cost,
      );
    }
  }
  return rows[left.length]![right.length]!;
}

export function scoreOverlapFamily(family: string, members: string[], token: string): number {
  if (family.includes(token)) return 35;
  return members.some((member) => member.includes(token)) ? 10 : 0;
}

export function textIncludesToken(value: string, token: string): boolean {
  return normalize(value).includes(token);
}
