export type TypeaheadCandidate<T> = {
  value: T;
  label: string;
  disabled?: boolean | undefined;
};

export function isTypeaheadKey(event: KeyboardEvent): boolean {
  return (
    event.key.length === 1 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey &&
    !event.isComposing
  );
}

export function findTypeaheadMatch<T>(
  candidates: readonly TypeaheadCandidate<T>[],
  prefix: string,
  currentIndex: number,
): T | undefined {
  if (candidates.length === 0) return undefined;

  const normalizedPrefix = prefix.toLocaleLowerCase();
  const startIndex = currentIndex < 0 ? -1 : currentIndex;

  for (let offset = 1; offset <= candidates.length; offset += 1) {
    const index = (startIndex + offset) % candidates.length;
    const candidate = candidates[index];
    if (!candidate || candidate.disabled) continue;
    if (candidate.label.toLocaleLowerCase().startsWith(normalizedPrefix)) {
      return candidate.value;
    }
  }

  return undefined;
}

export class TypeaheadBuffer {
  #value = '';
  #timer: ReturnType<typeof setTimeout> | null = null;

  push(character: string): string {
    this.clearTimer();
    this.#value += character.toLocaleLowerCase();
    this.#timer = setTimeout(() => {
      this.reset();
    }, 500);
    return this.#value;
  }

  reset(): void {
    this.clearTimer();
    this.#value = '';
  }

  clearTimer(): void {
    if (this.#timer === null) return;
    clearTimeout(this.#timer);
    this.#timer = null;
  }
}
