/// <reference lib="dom" />

export type SequentialFocusTarget = HTMLElement | SVGElement;

export function collectComposedElements(root: ParentNode): Element[] {
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

export function closestComposed(element: Element, selector: string): Element | null {
  let candidate: Element | null = element;
  while (candidate) {
    if (candidate.matches(selector)) return candidate;
    candidate = composedParentElement(candidate);
  }
  return null;
}

export function isRendered(element: Element): boolean {
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

export function composedParentElement(element: Element): Element | null {
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
  const host = root.host;
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

export function isHtmlElementNode(value: unknown): value is HTMLElement {
  return isElementNode(value) && value.namespaceURI === 'http://www.w3.org/1999/xhtml';
}

export function isSequentialFocusTarget(value: unknown): value is SequentialFocusTarget {
  return (
    isElementNode(value) &&
    (value.namespaceURI === 'http://www.w3.org/1999/xhtml' ||
      value.namespaceURI === 'http://www.w3.org/2000/svg')
  );
}

export function isParentNode(node: Node): node is Node & ParentNode {
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
type SearchableRoot = Document | DocumentFragment | Element;

export type ComposedFocusScope = { root: SearchableRoot; anchor: Element };

// Duck-type on `querySelectorAll` rather than `instanceof Document`: a root
// node can come from a different realm (another window/iframe, or a host
// whose `document` is not an `instanceof` of the ambient `Document`
// constructor at all — happy-dom's test Document does exactly this), where
// the constructor identity check fails even though the node is a genuine
// searchable document-like root.
function isSearchableRoot(node: Node): node is SearchableRoot {
  return typeof Reflect.get(node, 'querySelectorAll') === 'function';
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
  // `hasEnclosingShadowHost` gives the loop a reachable exit edge.
  // `isSearchableRoot`'s own condition can never be false here: every node
  // `anchor.getRootNode()` (or a shadow host's `getRootNode()`) can produce —
  // an Element, Document, ShadowRoot, or DocumentFragment — has
  // `querySelectorAll`, so the loop's only real exit is "no enclosing shadow
  // host left," tracked explicitly instead of relying on a condition that
  // can't go false.
  let hasEnclosingShadowHost = true;

  while (hasEnclosingShadowHost && isSearchableRoot(rootNode)) {
    yield { root: rootNode, anchor: referenceNode };
    const shadowRoot = rootNode instanceof ShadowRoot ? rootNode : null;
    hasEnclosingShadowHost = shadowRoot !== null;
    if (shadowRoot !== null) {
      referenceNode = shadowRoot.host;
      rootNode = referenceNode.getRootNode();
    }
  }
}
