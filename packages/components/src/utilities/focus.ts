/// <reference lib="dom" />

/**
 * Shared focus-restore helper used by overlay components (Modal, Sheet,
 * Popover) when returning focus on close. The candidate list is kept local
 * to each component — this helper enforces a uniform per-candidate safety
 * check and refuses to fall back to `document.body`.
 *
 * The check matches Popover's pre-existing strictness: the target must be
 * non-null, currently connected to the active document, and owned by that
 * document. When the candidate fails the check the helper no-ops and returns
 * `false` so callers can try the next candidate.
 */

/**
 * Attempt to focus `target`. Returns `true` when focus was moved, `false`
 * when the target failed the connection/ownership check or was null. Never
 * falls back to `document.body`.
 *
 * Usage (typical candidate iteration):
 *
 * ```ts
 * const candidates = [triggerRef, capturedFocus];
 * for (const candidate of candidates) {
 *   if (restoreFocusTo(candidate)) break;
 * }
 * ```
 */
export function restoreFocusTo(target: HTMLElement | null): boolean {
  if (!target) return false;
  if (typeof document === 'undefined') return false;
  if (!target.isConnected) return false;
  if (target.ownerDocument !== document) return false;
  try {
    target.focus();
  } catch {
    // happy-dom + jsdom can throw on focus() for exotic elements; treat as
    // a failed candidate so the caller can fall through to the next one.
    return false;
  }
  return true;
}

const sequentialFocusCandidateSelector = [
  'a[href]',
  'area[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  'frame',
  'iframe',
  'audio[controls]',
  'video[controls]',
  'embed',
  'object',
  '[contenteditable]',
  '[tabindex]',
].join(', ');

export type SequentialFocusRange = {
  relativeTo: Element;
  direction: 'before' | 'after';
  /**
   * The element whose tab-index tier candidates are compared against.
   * Defaults to `relativeTo`. Pass this separately when `relativeTo` is a
   * DOM-position anchor (for example, a container element used only to
   * locate the correct composed-tree boundary) that does not itself
   * participate in sequential tab order, so tier filtering would otherwise
   * fall back to `relativeTo`'s own (non-positive) tab index and drop every
   * positive-tabindex candidate regardless of the tier the caller actually
   * left off at.
   */
  tierReference?: Element;
};

export type SequentialFocusTarget = HTMLElement | SVGElement;

/** Return elements that participate in the document's sequential tab order. */
export function getSequentialFocusTargets(
  root: ParentNode | null,
  range?: SequentialFocusRange,
): SequentialFocusTarget[] {
  if (!root) return [];
  const composedElements = collectComposedElements(root);
  const relativeIndex = range ? composedElements.indexOf(range.relativeTo) : -1;
  if (range && relativeIndex === -1) return [];
  const tierReference = range?.tierReference ?? range?.relativeTo;
  // Composed-tree position, keyed by identity, for the same-tier/zero-tier
  // DOM-order tie-break inside `isSequentiallyAfterReference`. Built once
  // per call so every comparison is an O(1) lookup instead of a repeated
  // `indexOf`. Tie-breaks always measure against `relativeTo`'s position
  // (`relativeIndex`), never `tierReference`'s own — `tierReference` exists
  // purely to supply the correct tab-index *value* when `relativeTo` isn't
  // itself a focusable participant (see the type doc on `tierReference`).
  // Composed position is a different concern: `relativeTo` is the caller's
  // stable structural anchor (e.g. a component root that never moves),
  // while `tierReference` can be a live-focused element that a portal has
  // relocated elsewhere in the tree while open — using its position for
  // in-tier DOM ordering would compare against that temporary location
  // instead of the anchor the caller actually meant.
  const positionOf = range
    ? new Map(composedElements.map((element, index) => [element, index] as const))
    : null;
  const candidates = composedElements
    .filter(isSequentialFocusTarget)
    .filter(
      (element) =>
        !range ||
        (isSequentialFocusTarget(tierReference) &&
          isSequentiallyAfterReference(
            element,
            tierReference,
            range.direction,
            (positionOf?.get(element) ?? -1) - relativeIndex,
          )),
    )
    .filter((element) => element.matches(sequentialFocusCandidateSelector))
    .filter(isSequentialCandidate);
  const radios: {
    root: Node;
    form: HTMLElement | null;
    name: string;
    members: HTMLElement[];
  }[] = [];
  for (const candidate of candidates) {
    if (!isRadio(candidate)) continue;
    const rootNode = candidate.getRootNode();
    const name = candidate.getAttribute('name') ?? '';
    if (name === '') continue;
    const form = getFormOwner(candidate);
    const group = radios.find(
      (entry) => entry.root === rootNode && entry.form === form && entry.name === name,
    );
    if (!group) {
      const members = isParentNode(rootNode)
        ? collectComposedElements(rootNode)
            .filter(isSequentialFocusTarget)
            .filter(isRadio)
            .filter(
              (radio) =>
                radio.getRootNode() === rootNode &&
                radio.getAttribute('name') === name &&
                getFormOwner(radio) === form &&
                isSequentialCandidate(radio),
            )
        : [candidate];
      radios.push({
        root: rootNode,
        form,
        name,
        members,
      });
    }
  }
  const inRangeCandidates = new Set(candidates);
  const radioRepresentatives = new Set(
    radios.flatMap(({ members }) => {
      const checked = members.find((radio) => 'checked' in radio && radio.checked);
      if (checked) return [checked];
      // Native forward Tab enters an unchecked same-name radio group at its
      // first DOM-order member; native reverse Tab enters at its last
      // DOM-order member (the checked member wins in both directions when
      // present). Without a range — the whole-container enumeration case —
      // default to the forward-Tab entry point. `members` is gathered from
      // the whole root node, so a group that straddles the range boundary
      // (one member before `relativeTo`, one after) can otherwise pick a
      // fallback that isn't itself reachable in this direction. Narrow to
      // the members that survived the range filter above before picking,
      // so a straddling group's fallback always comes from its in-range
      // members only.
      const inRangeMembers = range
        ? members.filter((member) => inRangeCandidates.has(member))
        : members;
      const fallback = range?.direction === 'before' ? inRangeMembers.at(-1) : inRangeMembers[0];
      return fallback ? [fallback] : [];
    }),
  );
  const groupedRadios = new Set(radios.flatMap(({ members }) => members));
  return candidates
    .filter(
      (candidate) =>
        !isRadio(candidate) || !groupedRadios.has(candidate) || radioRepresentatives.has(candidate),
    )
    .sort((left, right) => {
      const leftTabIndex = sequentialTabIndexValue(left);
      const rightTabIndex = sequentialTabIndexValue(right);
      if (leftTabIndex === rightTabIndex) return 0;
      if (leftTabIndex === 0) return 1;
      if (rightTabIndex === 0) return -1;
      return leftTabIndex - rightTabIndex;
    });
}

function collectComposedElements(root: ParentNode): Element[] {
  const elements: Element[] = [];
  const visited = new Set<Element>();

  const visit = (element: Element, fromSlot = false): void => {
    if (visited.has(element)) return;
    if (!fromSlot && element.assignedSlot) return;
    visited.add(element);
    elements.push(element);
    if (isSlotElement(element)) {
      // A slot assigned only text nodes has no assigned *elements*, but
      // native fallback content only renders when the slot has no assigned
      // *nodes* at all. Gate on assignedNodes, not assignedElements, so an
      // all-text assignment still suppresses the slot's fallback children
      // from being treated as reachable focus targets.
      if (element.assignedNodes({ flatten: false }).length > 0) {
        for (const child of element.assignedElements({ flatten: true })) visit(child, true);
        return;
      }
    }
    const childRoot = element.shadowRoot ?? element;
    for (const child of Array.from(childRoot.children)) visit(child);
  };

  for (const child of Array.from(root.children)) visit(child);
  return elements;
}

type SlotElement = Element & {
  assignedElements(options?: { flatten?: boolean }): Element[];
  assignedNodes(options?: { flatten?: boolean }): Node[];
};

function isSlotElement(element: Element): element is SlotElement {
  return (
    element.localName === 'slot' &&
    typeof Reflect.get(element, 'assignedElements') === 'function' &&
    typeof Reflect.get(element, 'assignedNodes') === 'function'
  );
}

function isSequentialCandidate(candidate: SequentialFocusTarget): boolean {
  const explicitTabIndexValue = getExplicitTabIndexValue(candidate);
  if (candidate.matches('input[type="hidden"]')) return false;
  if (
    getTabIndexValue(candidate) < 0 ||
    candidate.matches(':disabled') ||
    closestComposed(candidate, '[hidden], [inert]') !== null ||
    !isRendered(candidate)
  )
    return false;
  if (candidate.matches('summary') && explicitTabIndexValue === null)
    return isFirstDetailsSummary(candidate) && !isInsideClosedDetails(candidate);
  if (isInsideClosedDetails(candidate)) return false;
  return true;
}

function hasNativeSequentialDefault(element: SequentialFocusTarget): boolean {
  return (
    element.matches(
      'button, input:not([type="hidden"]), a[href], area[href], select, textarea, summary, frame, iframe',
    ) ||
    element.matches('audio[controls], video[controls], embed[src]') ||
    (element.matches('object') && (element.getAttribute('data')?.trim().length ?? 0) > 0) ||
    (isHtmlElementNode(element) && isEditingHost(element))
  );
}

function isRadio(element: SequentialFocusTarget): element is HTMLElement {
  return (
    isHtmlElementNode(element) &&
    element.localName === 'input' &&
    element.getAttribute('type')?.toLowerCase() === 'radio'
  );
}

function getFormOwner(element: HTMLElement): HTMLElement | null {
  const formValue = 'form' in element ? Reflect.get(element, 'form') : null;
  return isHtmlElementNode(formValue) ? formValue : null;
}

function sequentialTabIndexValue(element: SequentialFocusTarget): number {
  return Math.max(0, getTabIndexValue(element));
}

function isSequentiallyAfterReference(
  element: SequentialFocusTarget,
  reference: SequentialFocusTarget,
  direction: SequentialFocusRange['direction'],
  relativePosition: number,
): boolean {
  const referenceTabIndex = getTabIndexValue(reference);
  const elementTabIndex = getTabIndexValue(element);
  const referenceIsPositive = referenceTabIndex > 0;
  const elementIsPositive = elementTabIndex > 0;

  // Native sequential focus order visits every positive-tabindex element
  // first (ascending, ties broken by composed-tree position), then every
  // zero/default-tabindex element (composed-tree position). Cross-tier
  // comparisons never depend on composed-tree position: a strictly higher
  // (for `after`) or lower (for `before`) tier than the reference's own
  // tier is always on that side of it, wherever it sits in the DOM —
  // native Tab order sorts by tabindex value first, position only breaks
  // ties *within* one tier. `relativePosition` (this element's composed
  // index minus the reference's) is consulted only for those same-tier or
  // both-zero-tier ties.
  if (direction === 'after') {
    if (referenceIsPositive) {
      if (!elementIsPositive) return true;
      if (elementTabIndex !== referenceTabIndex) return elementTabIndex > referenceTabIndex;
      return relativePosition > 0;
    }
    if (elementIsPositive) return false;
    return relativePosition > 0;
  }

  if (referenceIsPositive) {
    if (!elementIsPositive) return false;
    if (elementTabIndex !== referenceTabIndex) return elementTabIndex < referenceTabIndex;
    return relativePosition < 0;
  }
  if (elementIsPositive) return true;
  return relativePosition < 0;
}

export function getTabIndexValue(element: SequentialFocusTarget): number {
  return getExplicitTabIndexValue(element) ?? (hasNativeSequentialDefault(element) ? 0 : -1);
}

/**
 * Native Tab-order semantics restricted to a caller-gathered candidate pool
 * — typically a single foreign region's own `getSequentialFocusTargets(
 * region)` list (no range), which is already globally tier-sorted: every
 * positive-tabindex candidate ascending first, then every zero/default
 * candidate in composed order. Answers "which member of this pool does
 * forward/reverse Tab reach first, given the tab tier the caller is
 * bridging FROM?" — the shape every hand-rolled "enter this other region
 * relative to my current tier" fallback needs (a portaled panel's neighbor
 * region, a brand strip bridged into from a navigation item, and so on).
 *
 * `referenceTabIndex` is the tab tier being bridged from (0 for
 * zero/default). `direction: 'after'` returns the pool's first candidate
 * whose own tier is >= `referenceTabIndex` — except when `referenceTabIndex`
 * is itself 0, where only the pool's zero-tier candidate qualifies, since a
 * zero-tier reference has already passed every positive-tabindex one.
 * `direction: 'before'` returns the pool's last candidate whose tier is <=
 * `referenceTabIndex`, except when `referenceTabIndex` is 0, where every
 * positive-tabindex candidate in the pool already qualifies (positive tiers
 * always precede the zero tier), so it falls back to the pool's own last
 * candidate outright.
 *
 * When `referenceTabIndex` is positive and nothing in the pool clears it,
 * this returns `null` rather than falling back to the pool's zero-tier
 * candidate: a zero-tier candidate can never be "after" a positive
 * reference (zero tier is entirely visited after every positive tier), so
 * returning one would move focus backward. Callers with a further, wider
 * fallback (searching outward past this pool) should treat `null` as "keep
 * looking"; callers with no wider fallback available — because the pool is
 * the only reachable surface, e.g. a portaled panel — should fall back to
 * the pool's own zero-tier member explicitly instead of calling this.
 */
export function findSequentialEntryTarget(
  candidates: SequentialFocusTarget[],
  referenceTabIndex: number,
  direction: SequentialFocusRange['direction'],
): SequentialFocusTarget | null {
  if (direction === 'after') {
    if (referenceTabIndex > 0) {
      return (
        candidates.find((candidate) => getTabIndexValue(candidate) >= referenceTabIndex) ?? null
      );
    }
    // A zero/default-tier reference has already passed every positive-
    // tabindex candidate (positive tiers entirely precede the zero tier),
    // so only the pool's own zero-tier member can be "after" it — matching
    // on `tier >= 0` here would wrongly select a positive-tier candidate
    // that happens to sort first in the pool's global tier order.
    return candidates.find((candidate) => getTabIndexValue(candidate) === 0) ?? null;
  }
  if (referenceTabIndex === 0) return candidates.at(-1) ?? null;
  return (
    // `toReversed()` is ES2023; the repo targets ES2022, so copy first with
    // spread and reverse the copy in place instead. The spread already
    // produces a fresh array, so `reverse()` here never mutates `candidates`.
    // oxlint-disable-next-line unicorn/no-array-reverse
    [...candidates].reverse().find((candidate) => {
      const candidateTabIndex = getTabIndexValue(candidate);
      return candidateTabIndex > 0 && candidateTabIndex <= referenceTabIndex;
    }) ?? null
  );
}

function getExplicitTabIndexValue(element: SequentialFocusTarget): number | null {
  const rawValue = element.getAttribute('tabindex');
  if (rawValue !== null) {
    // HTML integer parsing consumes the leading signed digit sequence. Mirror
    // the reflected `long` range instead of relying on DOM-shim `tabIndex`
    // defaults, which differ from browsers for native controls.
    const match = /^[\t\n\f\r ]*([+-]?\d+)/.exec(rawValue);
    if (match?.[1]) {
      const parsedValue = Number(match[1]);
      return Number.isInteger(parsedValue) &&
        parsedValue >= -2_147_483_648 &&
        parsedValue <= 2_147_483_647
        ? parsedValue
        : -1;
    }
  }
  return null;
}

function isEditingHost(element: HTMLElement): boolean {
  return hasContentEditableState(element) && !hasContentEditableState(element.parentElement);
}

function hasContentEditableState(element: HTMLElement | null): boolean {
  for (let current = element; current; current = current.parentElement) {
    const value = current.getAttribute('contenteditable')?.toLowerCase();
    if (value === '' || value === 'true' || value === 'plaintext-only') return true;
    if (value === 'false') return false;
  }
  return false;
}

function isFirstDetailsSummary(element: SequentialFocusTarget): boolean {
  const details = element.parentElement;
  return (
    details?.tagName === 'DETAILS' &&
    Array.from(details.children).find((child) => child.tagName === 'SUMMARY') === element
  );
}

function isInsideClosedDetails(element: SequentialFocusTarget): boolean {
  let current: Element | null = composedParentElement(element);
  while (current) {
    const summary = Array.from(current.children).find((child) => child.tagName === 'SUMMARY');
    if (
      current.tagName === 'DETAILS' &&
      !current.hasAttribute('open') &&
      !(summary && composedContains(summary, element))
    )
      return true;
    current = composedParentElement(current);
  }
  return false;
}

/**
 * Composed-tree `contains()`: true when `descendant` is nested inside
 * `ancestor` even across an open shadow boundary. `Element.contains()`
 * only walks the light tree, so it reports `false` for a shadow-root
 * descendant of a light-DOM child of `ancestor` even though that
 * descendant still belongs to `ancestor`'s composed subtree.
 */
export function composedContains(ancestor: Element, descendant: SequentialFocusTarget): boolean {
  for (
    let current: Element | null = descendant;
    current;
    current = composedParentElement(current)
  ) {
    if (current === ancestor) return true;
  }
  return false;
}

function closestComposed(element: Element, selector: string): Element | null {
  let candidate: Element | null = element;
  while (candidate) {
    if (candidate.matches(selector)) return candidate;
    candidate = composedParentElement(candidate);
  }
  return null;
}

function isRendered(element: Element): boolean {
  if (typeof getComputedStyle !== 'function') return true;
  let candidate: Element | null = element;
  while (candidate) {
    const style = getComputedStyle(candidate);
    if (
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse'
    )
      return false;
    candidate = composedParentElement(candidate);
  }
  return true;
}

function composedParentElement(element: Element): Element | null {
  return assignedSlotFor(element) ?? element.parentElement ?? shadowHost(element.getRootNode());
}

function assignedSlotFor(element: Element): Element | null {
  if (isElementNode(element.assignedSlot)) return element.assignedSlot;
  const shadowRoot = element.parentElement?.shadowRoot;
  if (!shadowRoot) return null;
  for (const slot of shadowRoot.querySelectorAll('slot')) {
    if (isSlotElement(slot) && slot.assignedElements({ flatten: true }).includes(element)) {
      return slot;
    }
  }
  return null;
}

function shadowHost(root: Node): Element | null {
  if (!('host' in root)) return null;
  const host = (root as { host?: unknown }).host;
  return isElementNode(host) ? host : null;
}

function isElementNode(value: unknown): value is Element {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'nodeType' in value &&
    value.nodeType === 1 &&
    'namespaceURI' in value,
  );
}

function isHtmlElementNode(value: unknown): value is HTMLElement {
  return isElementNode(value) && value.namespaceURI === 'http://www.w3.org/1999/xhtml';
}

function isSequentialFocusTarget(value: unknown): value is SequentialFocusTarget {
  return (
    isElementNode(value) &&
    (value.namespaceURI === 'http://www.w3.org/1999/xhtml' ||
      value.namespaceURI === 'http://www.w3.org/2000/svg')
  );
}

function isParentNode(node: Node): node is Node & ParentNode {
  return 'children' in node;
}

/**
 * A composed-tree root to search for a sequential focus candidate, paired
 * with the element to measure `compareDocumentPosition` against at that
 * level. The first yielded scope is `anchor`'s own root (its ShadowRoot, if
 * it is rendered inside one); each subsequent scope escapes one shadow
 * boundary further out, pairing the enclosing shadow host as the new
 * anchor, until a plain Document is reached.
 */
export type ComposedFocusScope = { root: Document | ShadowRoot; anchor: Element };

// Duck-type on `querySelectorAll` rather than `instanceof Document`: a root
// node can come from a different realm (another window/iframe, or a host
// whose `document` is not an `instanceof` of the ambient `Document`
// constructor at all — happy-dom's test Document does exactly this), where
// the constructor identity check fails even though the node is a genuine
// searchable document-like root.
function isSearchableRoot(node: Node): node is Document | ShadowRoot {
  return 'querySelectorAll' in node;
}

/**
 * Walk the composed focus scope outward from `anchor`: its own root first,
 * then each enclosing shadow host's root in turn. A plain
 * `document.querySelectorAll` cannot see into shadow roots, so a component
 * rendered inside one needs this to find a sequential focus target that
 * lives in the same shadow root as itself, falling back to scopes further
 * out only once the nearer one is exhausted.
 */
export function* composedFocusScopes(anchor: Element): Generator<ComposedFocusScope> {
  let referenceNode: Element = anchor;
  let rootNode: Node = anchor.getRootNode();

  while (isSearchableRoot(rootNode)) {
    yield { root: rootNode, anchor: referenceNode };
    if (!(rootNode instanceof ShadowRoot)) return;
    referenceNode = rootNode.host;
    rootNode = referenceNode.getRootNode();
  }
}
