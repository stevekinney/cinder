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
  'iframe',
  'audio[controls]',
  'video[controls]',
  'embed',
  'object',
  '[contenteditable]',
  '[tabindex]',
].join(', ');

/** Return elements that participate in the document's sequential tab order. */
export function getSequentialFocusTargets(root: ParentNode | null): HTMLElement[] {
  if (!root) return [];
  const candidates = Array.from(
    root.querySelectorAll<HTMLElement>(sequentialFocusCandidateSelector),
  ).filter(isSequentialCandidate);
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
    const formValue = 'form' in candidate ? (candidate as { form?: unknown }).form : null;
    const form = isElementNode(formValue) ? formValue : null;
    const group = radios.find(
      (entry) => entry.root === rootNode && entry.form === form && entry.name === name,
    );
    if (group) group.members.push(candidate);
    else
      radios.push({
        root: rootNode,
        form,
        name,
        members: [candidate],
      });
  }
  const radioRepresentatives = new Set(
    radios.flatMap(({ members }) => [
      members.find((radio) => 'checked' in radio && radio.checked) ?? members[0],
    ]),
  );
  const groupedRadios = new Set(radios.flatMap(({ members }) => members));
  return candidates
    .filter((candidate) => !(groupedRadios.has(candidate) && !radioRepresentatives.has(candidate)))
    .sort((left, right) => {
      const leftTabIndex = explicitTabIndex(left);
      const rightTabIndex = explicitTabIndex(right);
      if (leftTabIndex === rightTabIndex) return 0;
      if (leftTabIndex === 0) return 1;
      if (rightTabIndex === 0) return -1;
      return leftTabIndex - rightTabIndex;
    });
}

function isSequentialCandidate(candidate: HTMLElement): boolean {
  const rawTabIndex = candidate.getAttribute('tabindex');
  if (candidate.matches('input[type="hidden"]')) return false;
  if (
    (rawTabIndex !== null && rawTabIndex.trim() !== '' && !Number.isFinite(Number(rawTabIndex))) ||
    (candidate.tabIndex < 0 && (rawTabIndex !== null || !hasNativeSequentialDefault(candidate))) ||
    candidate.matches(':disabled') ||
    closestComposed(candidate, '[hidden], [inert]') !== null ||
    !isRendered(candidate)
  )
    return false;
  if (candidate.getAttribute('contenteditable')?.toLowerCase() === 'false') return false;
  if (candidate.matches('summary'))
    return isFirstDetailsSummary(candidate) && !isInsideClosedDetails(candidate);
  if (isInsideClosedDetails(candidate)) return false;
  return true;
}

function hasNativeSequentialDefault(element: HTMLElement): boolean {
  return (
    element.matches('button, a[href], area[href], select, textarea, summary, iframe') ||
    element.matches('audio[controls], video[controls], embed[src], object') ||
    (element.hasAttribute('contenteditable') &&
      element.getAttribute('contenteditable')?.toLowerCase() !== 'false')
  );
}

function isRadio(element: HTMLElement): boolean {
  return element.localName === 'input' && element.getAttribute('type')?.toLowerCase() === 'radio';
}

function explicitTabIndex(element: HTMLElement): number {
  return element.hasAttribute('tabindex') ? Math.max(0, element.tabIndex) : 0;
}

function isFirstDetailsSummary(element: HTMLElement): boolean {
  const details = element.parentElement;
  return (
    details?.tagName === 'DETAILS' &&
    Array.from(details.children).find((child) => child.tagName === 'SUMMARY') === element
  );
}

function isInsideClosedDetails(element: HTMLElement): boolean {
  let current: HTMLElement | null = element.parentElement;
  while (current) {
    if (
      current.tagName === 'DETAILS' &&
      !current.hasAttribute('open') &&
      Array.from(current.children).find((child) => child.tagName === 'SUMMARY') !== element
    )
      return true;
    current = current.parentElement ?? shadowHost(current.getRootNode());
  }
  return false;
}

function closestComposed(element: HTMLElement, selector: string): HTMLElement | null {
  let candidate: HTMLElement | null = element;
  while (candidate) {
    if (candidate.matches(selector)) return candidate;
    const root = candidate.getRootNode();
    candidate = candidate.parentElement ?? shadowHost(root);
  }
  return null;
}

function isRendered(element: HTMLElement): boolean {
  if (typeof getComputedStyle !== 'function') return true;
  let candidate: HTMLElement | null = element;
  while (candidate) {
    const style = getComputedStyle(candidate);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const root = candidate.getRootNode();
    candidate = candidate.parentElement ?? shadowHost(root);
  }
  return true;
}

function shadowHost(root: Node): HTMLElement | null {
  if (!('host' in root)) return null;
  const host = (root as { host?: unknown }).host;
  return isElementNode(host) ? host : null;
}

function isElementNode(value: unknown): value is HTMLElement {
  return Boolean(value && typeof value === 'object' && 'nodeType' in value && value.nodeType === 1);
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
