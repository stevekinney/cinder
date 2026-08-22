/**
 * Per-scenario example mounting, source-fetching, and clipboard/overflow
 * helpers for the documentation page's Examples section.
 *
 * Follows the same split as `component-page-live-preview.ts` for a sibling
 * concern: this module owns the pure functions and mount-factory, while
 * `component-page.svelte` keeps the `$state`/`$effect` wiring and passes its
 * reactive state in as plain function parameters, so these functions stay
 * usable and testable without a Svelte runtime.
 */

import { flushSync, mount, unmount } from 'svelte';

import {
  formatErrorForClipboard,
  toMountErrorDetail,
  type MountErrorDetail,
  type SourceErrorDetail,
} from './example-error.ts';

export type ExampleMountState = {
  mountErrors: Record<string, MountErrorDetail | undefined>;
  onScenarioSettled?: (mountKey: string, error?: unknown) => void;
};

type ScenarioLoader = () => Promise<unknown>;
type CinderWindow = Window &
  typeof globalThis & {
    __CINDER_SCENARIOS__?: Record<string, unknown>;
    __CINDER_SCENARIO_LOADERS__?: Record<string, ScenarioLoader>;
  };

function scenarioComponentFromModule(module: unknown): unknown {
  if (typeof module === 'function') return module;
  if (module === null || typeof module !== 'object') return undefined;
  return Reflect.get(module, 'default');
}

/**
 * Mount each registered scenario into its preview container via an
 * attachment. An attachment runs exactly when its element is created and
 * tears down when the element is removed, so there is no effect-vs-DOM
 * timing race. The featured scenario can appear twice — once in Overview,
 * once in Examples — and each container gets its own attachment + its own
 * mount, so the two instances stay independent with correct per-node
 * cleanup.
 *
 * The mount-error record is keyed by the container's DOM `id`
 * (`overview-mount-<scenario>` vs `example-mount-<scenario>`), NOT by the
 * bare scenario, so a featured scenario rendered in BOTH locations gets one
 * error slot per render location. Keying by scenario alone would let
 * whichever attachment runs last clobber the other's entry — hiding a real
 * failure or painting an error callout over a preview that actually
 * rendered. The key is read from `element.id`, the same string the template
 * sets and the same string the template reads back via
 * `mountErrors[<container id>]`, so the two can never drift.
 */
export function createExampleMountHelpers(options: ExampleMountState): {
  mountScenario: (scenario: string) => (element: HTMLElement) => () => void;
  mountScenarioWhenVisible: (scenario: string) => (element: HTMLElement) => () => void;
} {
  const { mountErrors, onScenarioSettled } = options;
  const mountScenario = (scenario: string) => {
    return (element: HTMLElement) => {
      const mountKey = element.id;
      const registry = (window as CinderWindow).__CINDER_SCENARIOS__ ?? {};
      const registeredComponent = registry[scenario];
      const loader = (window as CinderWindow).__CINDER_SCENARIO_LOADERS__?.[scenario];
      let app: ReturnType<typeof mount> | undefined;
      let disposed = false;

      const mountComponent = (candidate: unknown) => {
        if (disposed) return;
        if (typeof candidate !== 'function') {
          const error = new Error(
            `[cinder playground] no registered component for scenario "${scenario}"`,
          );
          console.error(error.message);
          mountErrors[mountKey] = toMountErrorDetail(error);
          onScenarioSettled?.(mountKey, error);
          return;
        }
        try {
          const componentConstructor = candidate as Parameters<typeof mount>[0];
          const mountOptions = { target: element, props: { mountIdPrefix: mountKey } };
          // The static overview fragment is compiled by the isolated server
          // renderer, while this constructor comes from the page's client
          // bundle. Replacing that independently compiled fragment avoids
          // treating incompatible hydration markers as one component tree.
          // The replacement and mount happen in one task, so the server paint
          // remains visible until the interactive tree is ready to take over.
          element.replaceChildren();
          app = flushSync(() => mount(componentConstructor, mountOptions));
          mountErrors[mountKey] = undefined;
          onScenarioSettled?.(mountKey);
        } catch (error) {
          console.error(`[cinder playground] failed to mount example "${scenario}":`, error);
          mountErrors[mountKey] = toMountErrorDetail(error);
          onScenarioSettled?.(mountKey, error);
        }
      };

      if (typeof registeredComponent === 'function') {
        mountComponent(registeredComponent);
      } else if (loader !== undefined) {
        void loader()
          .then((module) => mountComponent(scenarioComponentFromModule(module)))
          .catch((error) => {
            if (disposed) return;
            console.error(`[cinder playground] failed to load example "${scenario}":`, error);
            mountErrors[mountKey] = toMountErrorDetail(error);
            onScenarioSettled?.(mountKey, error);
          });
      } else {
        mountComponent(undefined);
      }

      return () => {
        disposed = true;
        if (app === undefined) return;
        try {
          unmount(app);
        } catch {
          // Best-effort cleanup only.
        }
      };
    };
  };

  return {
    mountScenario,
    mountScenarioWhenVisible(scenario: string) {
      return (element: HTMLElement) => {
        if (typeof IntersectionObserver === 'undefined') return mountScenario(scenario)(element);

        let cleanupMount: (() => void) | undefined;
        const observer = new IntersectionObserver(
          (entries) => {
            if (!entries.some((entry) => entry.isIntersecting)) return;
            observer.disconnect();
            cleanupMount = mountScenario(scenario)(element);
          },
          { rootMargin: '400px 0px' },
        );
        observer.observe(element);

        return () => {
          observer.disconnect();
          cleanupMount?.();
        };
      };
    },
  };
}

export type FetchExampleSourceState = {
  fetchedSource: Record<string, string | null>;
  loadingSource: Record<string, boolean>;
  sourceErrors: Record<string, SourceErrorDetail | undefined>;
};

/**
 * Fetch one example's raw source, writing the result into `state`'s three
 * maps in place. Every write below is a property mutation on one of the
 * three maps — never a wholesale reassignment of `state.fetchedSource`,
 * `state.loadingSource`, or `state.sourceErrors` — because `component-page.svelte`
 * passes its own `$state` objects by reference into `state`; a whole-object
 * reassignment here would rebind the parameter to a new object without
 * updating the component's `$state` proxy the template reads, silently
 * breaking reactivity.
 */
export async function fetchExampleSource(
  componentName: string,
  scenario: string,
  state: FetchExampleSourceState,
): Promise<void> {
  const url = `/example-src/${componentName}/${scenario}`;
  state.loadingSource[scenario] = true;
  state.sourceErrors[scenario] = undefined;
  try {
    const response = await fetch(url);
    if (response.ok) {
      state.fetchedSource[scenario] = await response.text();
    } else {
      state.fetchedSource[scenario] = null;
      state.sourceErrors[scenario] = {
        url,
        detail: `${response.status} ${response.statusText}`.trim(),
      };
    }
  } catch (error) {
    state.fetchedSource[scenario] = null;
    state.sourceErrors[scenario] = {
      url,
      detail: error instanceof Error ? error.message : String(error),
    };
  } finally {
    state.loadingSource[scenario] = false;
  }
}

export async function copyErrorToClipboard(detail: MountErrorDetail): Promise<void> {
  if (typeof navigator === 'undefined' || navigator.clipboard === undefined) return;
  try {
    await navigator.clipboard.writeText(formatErrorForClipboard(detail));
  } catch {
    // Clipboard write can reject (permissions, insecure context).
  }
}

export function disclosureFor(
  disclosures: { scenario: string; expandedIds: string[] }[],
  scenario: string,
): { scenario: string; expandedIds: string[] } | undefined {
  return disclosures.find((entry) => entry.scenario === scenario);
}

/**
 * Measure a horizontal scroll container and report its overflow state via
 * `onOverflowChange`, re-measuring on element + content resize via
 * `ResizeObserver`. Drives the `is-scrollable` modifier on the scroll
 * container so the `::after` fade affordance renders ONLY while content
 * actually overflows.
 */
export function scrollOverflowSentinel(
  element: HTMLElement,
  onOverflowChange: (overflows: boolean) => void,
): () => void {
  const update = () => {
    // A 1px tolerance avoids flicker from sub-pixel layout rounding.
    onOverflowChange(element.scrollWidth - element.clientWidth > 1);
  };
  update();
  const observer = new ResizeObserver(update);
  observer.observe(element);
  // Table content can change width without the container resizing (e.g. async
  // prop rows arriving), so observe the first child too when present.
  if (element.firstElementChild instanceof HTMLElement) {
    observer.observe(element.firstElementChild);
  }
  return () => observer.disconnect();
}
