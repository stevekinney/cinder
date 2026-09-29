import { closestAcrossShadow } from './portal.utilities-events.svelte.ts';

export function findNearestOpenTopLayer(
  source: HTMLElement,
  isModalDialog: (element: HTMLElement) => boolean = (element) => element.matches(':modal'),
): HTMLElement | null {
  const selfTrigger = closestAcrossShadow(source, '.cinder-popover__trigger');
  let candidate: HTMLElement | null = source;
  while (candidate) {
    if (isNativeTopLayer(candidate, isModalDialog)) return candidate;
    if (candidate !== selfTrigger) {
      const owner = findPortalOwner(candidate);
      if (owner) return owner;
    }
    candidate = nextComposedAncestor(candidate);
  }
  return null;
}

function isNativeTopLayer(
  candidate: HTMLElement,
  isModalDialog: (element: HTMLElement) => boolean,
): boolean {
  try {
    return (
      (candidate.matches('dialog') && isModalDialog(candidate)) ||
      (candidate.matches('[popover]') && candidate.matches(':popover-open'))
    );
  } catch {
    return false;
  }
}

function findPortalOwner(candidate: HTMLElement): HTMLElement | null {
  const ownerId = candidate.dataset['cinderPortalOwner'];
  if (!ownerId) return null;
  const root = candidate.getRootNode();
  const localOwner =
    root instanceof ShadowRoot
      ? Array.from(root.querySelectorAll<HTMLElement>('[id]')).find(
          (element) => element.id === ownerId,
        )
      : root instanceof Document
        ? root.getElementById(ownerId)
        : null;
  const owner = localOwner ?? document.getElementById(ownerId);
  return owner instanceof HTMLElement ? owner : null;
}

function nextComposedAncestor(candidate: HTMLElement): HTMLElement | null {
  const root = candidate.getRootNode();
  const host = root instanceof ShadowRoot ? root.host : null;
  return candidate.parentElement ?? (host instanceof HTMLElement ? host : null);
}
