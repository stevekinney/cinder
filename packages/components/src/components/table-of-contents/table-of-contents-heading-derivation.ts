import type { TableOfContentsItem, TableOfContentsProps } from './table-of-contents.types.ts';

type ParsedHeading = {
  id: string;
  label: string;
  level: number;
};

function isNonNullable<TValue>(value: TValue | null | undefined): value is TValue {
  return value != null;
}

export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function resolveTargetElement(
  targetProp: TableOfContentsProps['target'],
): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null;
  }

  if (typeof targetProp === 'string') {
    const selector = targetProp.trim();
    if (selector === '') {
      return null;
    }
    return document.querySelector<HTMLElement>(selector);
  }

  if (targetProp instanceof HTMLElement) {
    return targetProp.isConnected ? targetProp : null;
  }

  return null;
}

function parseHeadingLevel(heading: HTMLElement): number | null {
  const match = /^H([1-6])$/.exec(heading.tagName);
  return match === null ? null : Number(match[1]);
}

function ensureHeadingId(
  heading: HTMLElement,
  fallbackLabel: string,
  index: number,
  seenIds: Set<string>,
): string {
  const rawId = heading.id.trim();
  const baseId =
    rawId !== '' ? rawId : slugifyHeading(fallbackLabel) || `section-${Math.max(index + 1, 1)}`;

  let candidate = baseId;
  let suffix = 2;

  while (hasConflictingHeadingId(candidate, heading, seenIds)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }

  if (heading.id !== candidate) {
    heading.id = candidate;
  }

  seenIds.add(candidate);
  return candidate;
}

function hasConflictingHeadingId(
  candidate: string,
  heading: HTMLElement,
  seenIds: Set<string>,
): boolean {
  if (seenIds.has(candidate)) {
    return true;
  }

  const existingHeading = document.getElementById(candidate);
  return existingHeading !== null && existingHeading !== heading;
}

export function deriveItemsFromHeadings(
  targetElement: HTMLElement | null,
  selector: string,
): TableOfContentsItem[] {
  if (targetElement === null) {
    return [];
  }

  const selectorToUse = selector.trim() === '' ? 'h2, h3, h4' : selector;
  const headings = [...targetElement.querySelectorAll<HTMLElement>(selectorToUse)];
  const seenIds = new Set<string>();

  const parsed: ParsedHeading[] = headings
    .map((heading, index) => {
      const label = heading.textContent?.trim() ?? '';
      const level = parseHeadingLevel(heading);
      if (label === '' || level === null) {
        return null;
      }

      const id = ensureHeadingId(heading, label, index, seenIds);
      return { id, label, level };
    })
    .filter(isNonNullable);

  const nested: TableOfContentsItem[] = [];
  const stack: Array<{ level: number; item: TableOfContentsItem }> = [];

  for (const heading of parsed) {
    const item: TableOfContentsItem = {
      id: heading.id,
      label: heading.label,
      level: heading.level,
      children: [],
    };

    while (stack.length > 0 && heading.level <= stack[stack.length - 1]!.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      nested.push(item);
    } else {
      stack[stack.length - 1]!.item.children?.push(item);
    }

    stack.push({ level: heading.level, item });
  }

  return nested;
}
