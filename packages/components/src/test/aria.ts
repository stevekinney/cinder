/**
 * ARIA attribute assertion helpers.
 *
 * Wrap the `getAttribute` + `expect` cycle with intent-revealing helpers so a11y
 * tests read like specs of the contract rather than DOM plumbing.
 */

/// <reference lib="dom" />

/**
 * Asserts that `element` has `attribute` set to `expected`.
 * Pass `null` for `expected` to assert the attribute is absent.
 */
export function expectAttribute(
  element: Element,
  attribute: string,
  expected: string | null,
): void {
  const actual = element.getAttribute(attribute);
  if (actual !== expected) {
    const tag = element.tagName.toLowerCase();
    throw new Error(
      `expected <${tag}> ${attribute} to be ${expected === null ? 'absent' : `"${expected}"`}, got ${
        actual === null ? 'absent' : `"${actual}"`
      }`,
    );
  }
}

/**
 * Asserts that `element` has every (attribute, value) pair from `attributes`.
 * Useful for shorthand multi-attribute assertions in WAI-ARIA pattern tests.
 */
export function expectAttributes(
  element: Element,
  attributes: Record<string, string | null>,
): void {
  for (const [name, value] of Object.entries(attributes)) {
    expectAttribute(element, name, value);
  }
}

/**
 * Returns the elements referenced by `aria-controls` / `aria-labelledby` /
 * `aria-describedby` on `element`. Whitespace-separated ID lists are resolved
 * against `element.ownerDocument`. Missing IDs are filtered out silently —
 * callers can assert on the array length to detect them.
 */
export function getRelated(element: Element, attribute: string): HTMLElement[] {
  const value = element.getAttribute(attribute);
  if (!value) return [];
  const doc = element.ownerDocument;
  const ids = value.split(/\s+/).filter(Boolean);
  const elements: HTMLElement[] = [];
  for (const id of ids) {
    const found = doc.getElementById(id);
    if (found) elements.push(found);
  }
  return elements;
}
