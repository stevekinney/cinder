import type { ScopeRoot } from './text-direction-css-primitives.ts';
import { replaceScopePseudoClass } from './text-direction-scope-pseudo.ts';

export function matchesRemainderAgainstScopeRoot(
  element: Element,
  selector: string,
  root: ScopeRoot,
): boolean {
  if (root.querySelector(':scope') === root)
    return Array.from(root.querySelectorAll(selector)).includes(element);
  const clone = cloneScopeRoot(root);
  if (!clone) return false;
  const marker = 'data-cinder-scope-root';
  const replacedSelector = replaceScopePseudoClass(selector, `[${marker}]`);
  if (isShadowScope(root) && /^\[[^\]]+\][^\s>+~]/.test(replacedSelector)) return false;
  clone.setAttribute(marker, 'true');
  const path = pathWithinScope(element, root);
  if (!path) return false;
  const counterpart = followElementPath(clone, path);
  return (
    (counterpart === clone && clone.matches(replacedSelector)) ||
    Array.from(clone.querySelectorAll(replacedSelector)).includes(counterpart)
  );
}

function isShadowScope(root: ScopeRoot): root is ShadowRoot {
  return typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot;
}

function cloneScopeRoot(root: ScopeRoot): Element | null {
  if (isShadowScope(root)) {
    const wrapper = root.ownerDocument.createElement('div');
    wrapper.append(...Array.from(root.children, (child) => child.cloneNode(true)));
    return wrapper;
  }
  const clone = root.cloneNode(true);
  return clone instanceof Element ? clone : null;
}

function pathWithinScope(element: Element, root: ScopeRoot): number[] | null {
  const path: number[] = [];
  let current: Element | null = element;
  while (current && current !== root) {
    const parent: Element | null = current.parentElement;
    if (!parent) {
      if (isShadowScope(root) && current.getRootNode() === root)
        path.unshift(Array.from(root.children).indexOf(current));
      break;
    }
    path.unshift(Array.from(parent.children).indexOf(current));
    current = parent;
  }
  const withinShadowRoot = isShadowScope(root) && current?.getRootNode() === root;
  return current === root || withinShadowRoot ? path : null;
}

function followElementPath(root: Element, path: readonly number[]): Element {
  let current = root;
  for (const index of path) {
    const child = current.children[index];
    if (!child) break;
    current = child;
  }
  return current;
}
