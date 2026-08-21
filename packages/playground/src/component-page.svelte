<!-- dev-only playground scaffold; immutable page data is injected server-side -->
<script lang="ts">
  import { type Snippet } from 'svelte';
  import { Accordion } from '@lostgradient/cinder/accordion';
  import { AccordionItem } from '@lostgradient/cinder/accordion-item';
  import { Alert } from '@lostgradient/cinder/alert';
  import { Badge } from '@lostgradient/cinder/badge';
  import { Button } from '@lostgradient/cinder/button';
  import { Callout } from '@lostgradient/cinder/callout';
  import { CodeBlock } from '@lostgradient/cinder/code-block';
  import { Collapsible } from '@lostgradient/cinder/collapsible';
  import { Kbd } from '@lostgradient/cinder/kbd';
  import { StatusDot } from '@lostgradient/cinder/status-dot';
  import { Table } from '@lostgradient/cinder/table';
  import { Toggle } from '@lostgradient/cinder/toggle';
  import { Tooltip } from '@lostgradient/cinder/tooltip';
  import Accessibility from 'lucide-svelte/icons/accessibility';
  import ArrowUpRight from 'lucide-svelte/icons/arrow-up-right';
  import Check from 'lucide-svelte/icons/check';
  import Copy from 'lucide-svelte/icons/copy';
  import Github from 'lucide-svelte/icons/github';
  import Moon from 'lucide-svelte/icons/moon';
  import ShieldCheck from 'lucide-svelte/icons/shield-check';
  import Sliders from 'lucide-svelte/icons/sliders-horizontal';
  import Sun from 'lucide-svelte/icons/sun';
  import X from 'lucide-svelte/icons/x';
  import { COMPOUND_COMPONENT_PARENTS } from './shell-app/compound-families.ts';
  import { humanizeComponentName } from './shell-app/humanize.ts';
  import {
    buildComponentHref,
    readFocusModeFromSearch,
    readViewFromSearch,
    searchForView,
    type ComponentPageView,
  } from './shell-app/routing.ts';
  import { persistScrollPosition } from './shell-app/sidebar-scroll.ts';
  import { createEventSource } from './shell-app/event-source.svelte.ts';
  import { splitReadmeHtml } from './split-readme-html.ts';
  import type { MountErrorDetail, SourceErrorDetail } from './example-error.ts';
  import { readComponentDocumentationDataIsland } from './component-documentation-reference.ts';
  import type {
    ComponentDocumentationPayload,
    JsonValue,
  } from './component-documentation-types.ts';
  import {
    renderPropDescription,
    splitUnionType,
    toPropReferenceRows,
  } from './manifest-reference.ts';
  import { computeActiveSection, type SectionOffset } from './component-page-scroll-spy.ts';
  import {
    buildPlaygroundModel,
    buildSnippet,
    type PlaygroundValue,
  } from './component-page-playground.ts';
  import { depictHighlighter, depictInlineHighlighter } from './depict-highlighter.ts';
  import { previewRecipeFor } from './component-page-preview-recipes.ts';
  import {
    canBareMount,
    createLivePreviewMount,
    LIVE_MOUNT_CONTAINER_ID,
    resolveBareComponent,
    toMountProps,
  } from './component-page-live-preview.ts';
  import {
    applyTheme,
    NAV_FILTER_STORAGE_KEY,
    PREVIEW_WIDTHS,
    readInitialPreviewWidth,
    readInitialTheme,
    readStoredNavFilter,
  } from './component-page-theme.ts';
  import {
    copyErrorToClipboard,
    createExampleMountHelpers,
    disclosureFor,
    fetchExampleSource,
    scrollOverflowSentinel,
  } from './component-page-example-mounts.ts';

  type CinderExampleDescriptor = {
    scenario: string;
    title: string;
    description?: string;
    featured?: boolean;
  };
  type CinderWindow = Window &
    typeof globalThis & {
      __CINDER_EXAMPLES__?: CinderExampleDescriptor[];
      __CINDER_SNAPSHOT_READY__?: Promise<void>;
    };
  type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  type StatusDotStatus = 'online' | 'warning' | 'danger' | 'pending' | 'neutral' | 'accent';

  // The bare component's module namespace is loaded by the page-bundle entry
  // only after a reader opens Playground. Keeping the loader as a prop rather
  // than reading a global makes the deferred live preview explicit and keeps
  // SSR/tests on the no-loader path.
  type Props = {
    bareComponentModule?: unknown;
    loadBareComponentModule?: () => Promise<unknown>;
    previewOnly?: boolean;
    /**
     * Request-known page inputs. The server passes these explicitly so the SSR
     * tree can be built without touching `window`; the client bundle passes the
     * same values it reads from the URL and data islands. When omitted, each
     * falls back to reading the browser environment (guarded for SSR), which is
     * what the unit tests rely on.
     */
    componentName?: string;
    examples?: CinderExampleDescriptor[];
    snapshotMode?: boolean;
    documentation?: ComponentDocumentationPayload | null;
    documentationError?: string | null;
    /**
     * Sidebar navigation entries. Supplied by both render paths so the nav is
     * part of THIS component's tree — one hydration root, no separate shell
     * bundle. Empty means no sidebar (snapshot and preview surfaces).
     */
    sidebarComponents?: string[];
    /**
     * Landing mode. When set, the page renders this README in the prose column
     * instead of component documentation — same nav, same top bar, same theme
     * control. The site had two different chromes before this; now `/` and
     * `/page/<name>` are the same layout with different content.
     */
    readmeHtml?: string;
    /** Extra top-bar actions, e.g. the landing page's colour-token trigger. */
    toolbarActions?: Snippet;
    /** Page-level overlays rendered inside the shell wrapper. */
    overlays?: Snippet;
    /**
     * Notified whenever the page's theme control changes the active theme. The
     * landing page uses this to keep the colour-token panel's store pointed at
     * the theme the reader is actually looking at — overrides are stored per
     * theme, so a stale store leaks light edits into dark.
     */
    onThemeChange?: (theme: 'light' | 'dark') => void;
  };

  let {
    bareComponentModule: bareComponentModuleProp,
    loadBareComponentModule,
    previewOnly = false,
    componentName: componentNameProp,
    examples: examplesProp,
    snapshotMode: snapshotModeProp,
    documentation: documentationProp,
    documentationError: documentationErrorProp,
    sidebarComponents = [],
    readmeHtml,
    toolbarActions,
    overlays,
    onThemeChange,
  }: Props = $props();

  let bareComponentModule = $state(bareComponentModuleProp);

  /** True on `/`, which renders the README through this same chrome. */
  const isLanding = $derived(readmeHtml !== undefined);

  // Height of the sticky top bar, in pixels — used for scroll-spy activation
  // and smooth-scroll offset so anchored sections clear the bar.
  // The sticky top bar was removed; its height stays as a named zero so the
  // scroll-spy and smooth-scroll offsets keep reading as deliberate.
  const TOP_BAR_HEIGHT = 0;

  function readExamples(): CinderExampleDescriptor[] {
    if (typeof window === 'undefined') return [];
    const raw = (window as CinderWindow).__CINDER_EXAMPLES__;
    return Array.isArray(raw) ? raw : [];
  }

  const examples: CinderExampleDescriptor[] = examplesProp ?? readExamples();
  const explicitlyFeatured = examples.filter((example) => example.featured === true);

  // Snapshot mode (`?snapshot=1`) is how the visual-regression and a11y test
  // harness loads this route. Those tests assert global single-instance counts
  // (e.g. exactly one `.cinder-section-heading`), so we must not mount the
  // featured example twice. The Overview live preview is therefore suppressed in
  // snapshot mode — the Examples section still mounts each scenario exactly once.
  const snapshotMode =
    snapshotModeProp ??
    (typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('snapshot') === '1');

  // The Overview live preview uses the first featured example, or the first
  // example overall. Undefined when there are no examples at all, and suppressed
  // in snapshot mode so it never double-mounts a scenario the Examples section
  // already shows.
  const overviewExample: CinderExampleDescriptor | undefined = snapshotMode
    ? undefined
    : (explicitlyFeatured[0] ?? examples[0]);

  // The component this page documents. Supplied as a prop by both render paths;
  // falls back to parsing the current URL path (`/page/<name>`) when absent.
  function readComponentNameFromLocation(): string {
    if (typeof window === 'undefined') return '';
    return window.location.pathname.replace(/^\/page\//, '').split('/')[0] ?? '';
  }

  const componentName: string = componentNameProp ?? readComponentNameFromLocation();

  // Snapshot consumers need the scenario mounts, not merely the outer page
  // chrome. Expose the actual completion promise so the browser harness can
  // await it directly: a rejected dynamic import reaches the test as its
  // original error instead of becoming a second polling timeout.
  const snapshotMountKeys = new Set(examples.map(({ scenario }) => `example-mount-${scenario}`));
  let settleSnapshotMount: (mountKey: string, error?: unknown) => void = () => undefined;
  if (snapshotMode && typeof window !== 'undefined') {
    let resolveSnapshotReady: () => void;
    let rejectSnapshotReady: (reason?: unknown) => void;
    const snapshotReady = new Promise<void>((resolve, reject) => {
      resolveSnapshotReady = resolve;
      rejectSnapshotReady = reject;
    });
    // A rejected promise is consumed by the test fixture; observe it here as
    // well so a loader failure does not surface as an unrelated browser-level
    // unhandled-rejection warning before that fixture evaluates the promise.
    void snapshotReady.catch(() => undefined);
    (window as CinderWindow).__CINDER_SNAPSHOT_READY__ = snapshotReady;
    if (snapshotMountKeys.size === 0) {
      resolveSnapshotReady!();
    } else {
      const settledMounts = new Set<string>();
      settleSnapshotMount = (mountKey, error) => {
        if (error !== undefined) {
          rejectSnapshotReady!(error);
          return;
        }
        if (!snapshotMountKeys.has(mountKey)) return;
        settledMounts.add(mountKey);
        if (settledMounts.size === snapshotMountKeys.size) resolveSnapshotReady!();
      };
    }
  }

  // The canonical page owns the preview now, so subscribe directly to the
  // dev-server stream. Snapshot pages deliberately stay quiet: automated
  // visual and focus suites share the dev server and a reload would interrupt
  // the test currently driving the page.
  const liveReloadUrl = !snapshotMode && typeof window !== 'undefined' ? '/events' : null;
  function handleLiveReload(): void {
    window.location.reload();
  }

  // --- Theme toggle -----------------------------------------------------
  // Cinder tokens switch on `color-scheme` (via `light-dark()`); the playground
  // bridge mirrors the same value onto `data-cinder-theme` for bookkeeping. We
  // read the active scheme on mount and, on toggle, write BOTH `color-scheme`
  // (the real switch) and `data-cinder-theme` so we stay consistent with the
  // bridge, plus persist to localStorage under the pre-paint key.
  // Server rendering has no `document`, so the SSR tree seeds `light` — matching
  // the base `color-scheme: light dark` first argument — and the real preference
  // is adopted in `onMount`. Seeding from the document during init would make the
  // server and client first render disagree (a hydration mismatch); deferring the
  // read is the same discipline `shell.svelte` uses for its persisted theme.
  // Seeded to `light` on BOTH sides — never from the document — so the server's
  // markup and the client's hydration render agree on the toggle's icon and
  // label. The real preference (set by the pre-paint script from the URL or
  // localStorage) is adopted immediately after mount. Reading it during init
  // would render a Sun on the server and a Moon on the client for dark-mode
  // users: a hydration mismatch.
  let theme = $state<'light' | 'dark'>('light');

  // False during SSR and during the client's hydration render; true from mount
  // onward. Gates anything that cannot exist server-side (the live component
  // mount, which needs a module namespace the server never has) so both sides
  // render the same tree on first pass.
  let isHydrated = $state(false);

  /*
   * Adopt the real theme and flip the hydration flag once the client is live.
   *
   * An `$effect` rather than `onMount`: effects simply do not run on the server,
   * whereas `onMount` THROWS there (`lifecycle_function_unavailable`). This
   * component is compiled for both targets now, so the lifecycle hook is not
   * safe here. Nothing reactive is read, so this runs exactly once.
   */
  $effect(() => {
    theme = readInitialTheme();
    onThemeChange?.(theme);
    isHydrated = true;
    navFilter = readStoredNavFilter();
    navFilterRestored = true;
    // Adopted after hydration, not during init: the server cannot read the URL's
    // toolbar state without the two trees disagreeing.
    previewWidth = readInitialPreviewWidth();
    const search = new URLSearchParams(window.location.search);
    isFocusMode = readFocusModeFromSearch(search);
    activeView = readViewFromSearch(search);
  });

  /**
   * Which of the two views the page is showing (decision 2).
   *
   * Seeded to `documentation` on BOTH server and client so the first render
   * agrees, then adopted from the URL after hydration — the same discipline the
   * theme and focus-mode state already use. Reading `location.search` during
   * init would render the docs view on the server and the playground view on
   * the client for anyone following a `?view=playground` link.
   */
  let activeView = $state<ComponentPageView>('documentation');

  // The documentation view is deliberately hydratable without the selected
  // component's implementation. Import it only when the reader asks for the
  // interactive Playground; both SSR and the initial client render therefore
  // keep the same `undefined` module value.
  $effect(() => {
    if (
      !isHydrated ||
      activeView !== 'playground' ||
      bareComponentModule !== undefined ||
      loadBareComponentModule === undefined
    ) {
      return;
    }
    let cancelled = false;
    void loadBareComponentModule()
      .then((module) => {
        if (!cancelled) bareComponentModule = module;
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('[cinder playground] failed to load bare component:', error);
        }
      });
    return () => {
      cancelled = true;
    };
  });

  /**
   * Arrow/Home/End navigation for the view switcher.
   *
   * `role="tablist"` is a promise about keyboard behavior, not just a label: a
   * screen-reader user who lands on the strip expects the arrow keys to move
   * between tabs. The roving `tabindex` alone only gets them INTO the strip.
   */
  function onViewTabKeydown(event: KeyboardEvent): void {
    const order: ComponentPageView[] = ['documentation', 'playground'];
    const current = order.indexOf(activeView);
    let next: ComponentPageView | undefined;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = order[(current + 1) % order.length];
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = order[(current - 1 + order.length) % order.length];
    } else if (event.key === 'Home') {
      next = order[0];
    } else if (event.key === 'End') {
      next = order[order.length - 1];
    }
    if (next === undefined) return;
    event.preventDefault();
    selectView(next);
    // Selection follows focus, so move focus with it — otherwise the newly
    // selected tab has `tabindex="0"` while focus sits on a `-1` sibling.
    document.getElementById(`view-tab-${next}`)?.focus();
  }

  function selectView(view: ComponentPageView): void {
    activeView = view;
    if (typeof window === 'undefined') return;
    // `replaceState`, not `pushState`: flipping a view is not a navigation the
    // Back button should have to walk through, but the URL must stay shareable.
    const search = searchForView(new URLSearchParams(window.location.search), view);
    window.history.replaceState(null, '', `${window.location.pathname}${search}`);
  }

  let previewWidth = $state<number | null>(null);

  /** Focus mode expands the stage over the viewport; Escape exits. */
  let isFocusMode = $state(false);

  /*
   * Component-nav filter. Matches against both the raw kebab id and the
   * humanized label, so typing either "alert-dialog" or "Alert dialog" works.
   * Persisted across navigation. Selecting a component is a full document
   * load, so without this a filtered list resets the moment you use it.
   */
  let navFilter = $state('');

  /*
   * Writes are held until the stored value has been restored. Without the guard
   * this effect fires on the initial empty `navFilter` and clobbers the stored
   * filter before the mount effect can read it back — the persistence would
   * silently never work.
   */
  let navFilterRestored = $state(false);

  $effect(() => {
    if (!navFilterRestored) return;
    try {
      sessionStorage.setItem(NAV_FILTER_STORAGE_KEY, navFilter);
    } catch {
      // Private mode / disabled storage — filtering still works in-session.
    }
  });

  const visibleComponents = $derived.by(() => {
    const query = navFilter.trim().toLowerCase();
    if (query === '') return sidebarComponents;
    return sidebarComponents.filter(
      (name) => name.includes(query) || humanizeComponentName(name).toLowerCase().includes(query),
    );
  });

  /**
   * Groups `visibleComponents` by compound-family root, keyed on first
   * appearance so alphabetical ordering is preserved (`chat` sorts immediately
   * before `chat-composer-popover`, so its group lands in the same spot the
   * flat list already put it). A group is created on demand under a child's
   * root key even when the root itself is absent from `visibleComponents` —
   * the nav filter can hide the root while keeping a matching child (a search
   * for "conversation" hides `chat` but keeps `chat-conversation-list`), and a
   * fixture or filtered caller can pass a compose-only leaf directly without
   * its root — either way the child stays reachable under a synthesized group
   * rather than rendering as an orphaned top-level entry.
   */
  type NavigationGroup = { name: string; children: string[] };

  const navigationGroups = $derived.by((): NavigationGroup[] => {
    const groups = new Map<string, NavigationGroup>();
    for (const name of visibleComponents) {
      const root = COMPOUND_COMPONENT_PARENTS[name];
      if (root !== undefined) {
        const group = groups.get(root) ?? { name: root, children: [] };
        group.children.push(name);
        groups.set(root, group);
        continue;
      }
      if (!groups.has(name)) groups.set(name, { name, children: [] });
    }
    return [...groups.values()];
  });

  /*
   * Escape exits focus mode.
   *
   * Registered through an effect rather than `<svelte:window>`: that tag has to
   * be top level, and a second top-level node makes happy-dom's fragment
   * handling throw on `firstChild` in the documentation tests. Effects also do
   * not run on the server, so there is no SSR guard to remember.
   */
  $effect(() => {
    if (!isFocusMode) return;

    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;

      isFocusMode = false;
    };

    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  });

  let themeToggleLabel = $derived(
    theme === 'dark' ? 'Preview theme: switch to light' : 'Preview theme: switch to dark',
  );

  function toggleTheme(): void {
    theme = theme === 'dark' ? 'light' : 'dark';
    onThemeChange?.(theme);
    applyTheme(theme);
  }

  // --- Source-fetch + per-scenario accordion (preserved from the tabbed page) -
  const fetchedSource: Record<string, string | null> = $state({});
  const loadingSource: Record<string, boolean> = $state({});
  // Keyed by mount-container DOM id (`overview-mount-<scenario>` /
  // `example-mount-<scenario>`), not by bare scenario, so a featured scenario
  // mounted in both the Overview and Examples locations keeps an independent
  // error slot per location. See `mountScenario`.
  const mountErrors: Record<string, MountErrorDetail | undefined> = $state({});
  const sourceErrors: Record<string, SourceErrorDetail | undefined> = $state({});
  const exampleDisclosures = $state(
    examples.map(({ scenario }) => ({ scenario, expandedIds: [] as string[] })),
  );

  // Lazily fetch each example's source the first time its disclosure opens.
  $effect(() => {
    for (const entry of exampleDisclosures) {
      if (
        entry.expandedIds.includes(`source-${entry.scenario}`) &&
        fetchedSource[entry.scenario] === undefined &&
        !loadingSource[entry.scenario]
      ) {
        void fetchExampleSource(componentName, entry.scenario, {
          fetchedSource,
          loadingSource,
          sourceErrors,
        });
      }
    }
  });

  // Mount each registered scenario into its preview container via an attachment.
  // An attachment runs exactly when its element is created and tears down when
  // the element is removed, so there is no effect-vs-DOM timing race (the old
  // effect-based approach mounted before the `{#if documentation}` subtree was
  // patched in). The featured scenario can appear twice — once in Overview, once
  // in Examples — and each container gets its own attachment + its own mount, so
  // the two instances stay independent with correct per-node cleanup. See
  // `component-page-example-mounts.ts` for the mount-error keying discipline.
  const { mountScenario } = createExampleMountHelpers({
    mountErrors,
    onScenarioSettled: settleSnapshotMount,
  });

  // Whether the props table currently overflows horizontally. Drives the
  // `is-scrollable` modifier on the scroll container so the `::after` fade
  // affordance renders ONLY while content actually overflows — a non-overflowing
  // table must not show a misleading fade over its right edge. Held in `$state`
  // (rather than toggled imperatively) so the binding is statically analysable.
  let propsTableOverflows = $state(false);

  // --- Documentation payload --------------------------------------------
  // Documentation is immutable for a deployed build, so the server embeds it
  // in the page HTML and the client reads it synchronously before first render.
  let documentation: ComponentDocumentationPayload | null = $state(null);
  let documentationError: string | null = $state(null);
  if (documentationProp !== undefined || documentationErrorProp !== undefined) {
    // Supplied by the render path (server SSR or the client bundle entry).
    documentation = documentationProp ?? null;
    documentationError = documentationErrorProp ?? null;
  } else if (typeof document !== 'undefined') {
    try {
      documentation = readComponentDocumentationDataIsland();
    } catch (error) {
      documentationError =
        error instanceof Error ? error.message : 'Failed to read component documentation.';
    }
  }

  const propRows = $derived(
    documentation === null ? [] : toPropReferenceRows(documentation.propsManifest),
  );

  /**
   * A union is "short" when it has ≤4 members and every member is ≤20
   * characters, so the whole type fits comfortably inline as `A | B | C`.
   */
  function isShortUnion(members: readonly string[]): boolean {
    return members.length <= 4 && members.every((member) => member.length <= 20);
  }

  /**
   * The props table's columns, in render order.
   *
   * The header cells, each body cell's `data-label`, and the stacked-layout
   * `::before` labels all read from this one list. They used to be three
   * independent things, with the stacked labels positioned by `nth-child` — so
   * dropping the Required and Bindable columns would have silently relabelled
   * Description as "Required" and left the real Description rule matching
   * nothing. Nothing errors; the narrow-container card just lies, and only below
   * a 34rem CONTAINER width where a desktop check never looks.
   */
  const PROP_COLUMNS = [
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type' },
    { key: 'default', label: 'Default' },
    { key: 'description', label: 'Description' },
  ] as const;

  /**
   * Union members rendered before the remainder moves behind a disclosure.
   *
   * `PhoneInput.country` is a 245-member union — an unbounded vertical wall of
   * country codes in a table cell, at every width. There was already an
   * `isShortUnion` threshold on the short side and nothing on the long side.
   * Nothing is discarded: a reader checking whether `'GB'` is in the list can
   * still open it, and for a union there is no alias name to fall back on (the
   * analyzer resolves it to its options before the manifest is written).
   */
  const UNION_PREVIEW_COUNT = 8;

  /**
   * Characters of a single (non-union) type rendered before it is truncated.
   *
   * The long-side twin of the union cap, for structural types: `Statistic.change`
   * is a 540-character inline object type — JSDoc comments and all — and
   * `DateRangeField.value` and `ApprovalCard.sandbox` are the same shape. One
   * policy for type complexity, not two.
   */
  const SINGLE_TYPE_PREVIEW_CHARS = 160;

  function statusDotStatus(status: string): StatusDotStatus {
    switch (status) {
      case 'stable':
        return 'online';
      case 'beta':
        return 'accent';
      case 'alpha':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  function statusBadgeVariant(status: string): BadgeVariant {
    switch (status) {
      case 'stable':
        return 'success';
      case 'beta':
        return 'info';
      case 'alpha':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  // --- Import line copy --------------------------------------------------
  let importCopied = $state(false);
  const importStatement = $derived(
    documentation === null
      ? ''
      : `import { ${documentation.component.exportName} } from '${documentation.component.importSpecifier}';`,
  );
  let highlightedImportStatement = $state('');

  // The hero import is a code surface, not a decorative monospace label. Use
  // the same depict Shiki pipeline as README fences and CodeBlock so imports
  // follow the active Cinder theme instead of becoming the last plaintext path.
  $effect(() => {
    let cancelled = false;
    void depictInlineHighlighter(importStatement, 'ts')
      .then((html) => {
        if (!cancelled) highlightedImportStatement = html;
      })
      .catch(() => {
        // Keep the copyable plain-text fallback if the optional highlighter
        // cannot initialize. The code remains visible and correct.
        if (!cancelled) highlightedImportStatement = '';
      });
    return () => {
      cancelled = true;
    };
  });

  async function copyImport(): Promise<void> {
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) return;
    try {
      await navigator.clipboard.writeText(importStatement);
      importCopied = true;
    } catch {
      // Clipboard unavailable — copying is a convenience, never load-bearing.
    }
  }

  // Reset the "copied" flag after a beat. Driving the timer through an $effect
  // ties it to the component lifecycle, so a teardown mid-flight cancels it
  // instead of writing to torn-down state.
  $effect(() => {
    if (!importCopied) return;
    const timer = setTimeout(() => {
      importCopied = false;
    }, 1500);
    return () => clearTimeout(timer);
  });

  // --- Playground controls ----------------------------------------------
  const playgroundModel = $derived(
    documentation === null
      ? {
          controls: [],
          seeds: [],
          skipped: [],
          unsatisfiedRequired: [],
          hasUnsatisfiedRequired: false,
          requiresExamplePlayground: false,
          examplePlaygroundReason: undefined,
        }
      : buildPlaygroundModel(documentation.propsManifest),
  );
  /**
   * Stage scaffolding for components no amount of prop seeding makes legible —
   * layout primitives, Surface, and the behavior-only wrappers. See
   * `component-page-preview-recipes.ts`.
   */
  const previewRecipe = $derived(
    documentation === null ? undefined : previewRecipeFor(documentation.propsManifest.kebabName),
  );
  // Live control values, keyed by prop name. A preview recipe's concrete props
  // seed matching controls, so what the reader sees in a control always matches
  // the rendered baseline; otherwise use the manifest-derived control value.
  const playgroundValues: Record<string, PlaygroundValue> = $state({});
  let playgroundSeeded = false;
  $effect(() => {
    if (playgroundSeeded || playgroundModel.controls.length === 0) return;
    for (const control of playgroundModel.controls) {
      const recipeValue = previewRecipe?.props?.[control.name];
      playgroundValues[control.name] =
        typeof recipeValue === 'boolean' ||
        typeof recipeValue === 'number' ||
        typeof recipeValue === 'string'
          ? recipeValue
          : control.value;
    }
    playgroundSeeded = true;
  });

  const playgroundSnippet = $derived(
    documentation === null
      ? ''
      : buildSnippet(
          documentation.component.exportName,
          playgroundModel.controls,
          playgroundValues,
          playgroundModel.seeds,
          documentation.propsManifest.importPath,
          previewRecipe?.props,
          previewRecipe?.snippetChildren,
        ),
  );
  /**
   * Whether the GENERATED artifacts — the live bare mount and the copyable
   * snippet — can be trusted for this component. False when a required prop has
   * no synthesizable value (the snippet would not compile) or when the component
   * is documented through its examples instead.
   *
   * This gates ONLY the generated pieces. It deliberately does NOT gate the
   * section: the featured example, the prop controls, and the surrounding chrome
   * stay. Gating the whole `.dx-play` block on this is what made a synthesis
   * failure indistinguishable from a component that genuinely has no props —
   * ~20 components lost their entire Playground section and were told, falsely,
   * that they had nothing to adjust.
   */
  const canGenerateFromProps = $derived(
    !playgroundModel.hasUnsatisfiedRequired && !playgroundModel.requiresExamplePlayground,
  );
  const hasGeneratedControls = $derived(
    canGenerateFromProps && playgroundModel.controls.length > 0,
  );
  const playgroundChildrenText = $derived.by(() => {
    const childrenControl = playgroundModel.controls.find(
      (control) => control.kind === 'text' && control.isChildren === true,
    );
    return childrenControl === undefined
      ? ''
      : String(playgroundValues[childrenControl.name] ?? childrenControl.value);
  });

  /**
   * The reader-facing explanation for a missing generated preview, or `null`
   * when there is nothing to explain. Three distinct states the old single line
   * collapsed into one (usually untrue) sentence:
   *
   *  - `example-only`  — the component is documented through its examples.
   *  - `unsatisfied`   — a required prop can't be synthesized, so the generated
   *                      snippet is withheld. Names the props, because "we
   *                      couldn't" is only useful if the reader can see what.
   *  - `no-props`      — the honest original: there really is nothing to adjust.
   */
  type PlaygroundNote =
    | { kind: 'example-only'; reason: 'behavior' | 'structured-children' }
    | { kind: 'unsatisfied'; props: string[]; hasFallback: boolean }
    | { kind: 'no-props' };

  const playgroundNote = $derived.by<PlaygroundNote | null>(() => {
    if (playgroundModel.requiresExamplePlayground) {
      return {
        kind: 'example-only',
        reason: playgroundModel.examplePlaygroundReason ?? 'behavior',
      };
    }
    if (playgroundModel.unsatisfiedRequired.length > 0) {
      return {
        kind: 'unsatisfied',
        props: playgroundModel.unsatisfiedRequired,
        hasFallback: overviewExample !== undefined,
      };
    }
    if (playgroundModel.controls.length === 0) return { kind: 'no-props' };
    return null;
  });

  // The bare component constructor for the Playground section's LIVE preview
  // (#405): resolved from the module namespace passed in as a prop by the page
  // bundle, by the documented `exportName` (falling back to the default export).
  // `undefined` when the module wasn't provided or the export isn't a component,
  // in which case the section degrades to the static featured-example mount.
  //
  // Compound ROOTS (Accordion, Tabs, …) and context-requiring PARTS
  // (accordion-item, tab, table-header-cell, …) both resolve to `undefined` here
  // on purpose — see `canBareMount` for why neither can be mounted alone. Roots
  // take the featured-example fallback; parts have no examples of their own and
  // take the compose-guidance branch below.
  const canMountBare = $derived(
    documentation !== null &&
      canBareMount(documentation.propsManifest.kebabName, documentation.propsManifest.isCompound),
  );
  const hasFocusablePreview = $derived(
    overviewExample !== undefined || (canGenerateFromProps && canMountBare),
  );

  const bareComponent = $derived(
    documentation === null || !canMountBare || previewRecipe?.prefersFeaturedExample === true
      ? undefined
      : resolveBareComponent(bareComponentModule, documentation.component.exportName),
  );

  /**
   * The compound root a part composes into, or `undefined` for anything that is
   * not a part. Drives the stage's compose-guidance branch: a part has no live
   * mount and no examples of its own, so without this its stage is a permanently
   * empty frame. Pointing at the root — which documents the real composition — is
   * the useful thing to put there.
   */
  const composesInto = $derived(
    documentation === null
      ? undefined
      : COMPOUND_COMPONENT_PARENTS[documentation.propsManifest.kebabName],
  );

  // The `{@attach …}` factory that mounts the bare component live. The props are
  // passed EAGERLY at the call site in the template
  // (`mountLivePreview(bareComponent, $state.snapshot(playgroundValues))`) so the
  // reactive read of `playgroundValues` happens in the attach EXPRESSION — that is
  // what makes Svelte re-run the attachment (teardown + fresh mount) on every
  // control change, so the preview tracks the controls. See
  // `component-page-live-preview.ts` for why the read must be in the expression and
  // the text-control focus-loss trade-off.
  const mountLivePreview = createLivePreviewMount({ mountErrors });

  // True once the live mount has recorded a failure. The Playground template
  // uses this to fall through to the featured example when the bare mount fails
  // and a featured example exists — a component whose bare mount throws (an
  // unsynthesized required snippet, a missing context provider, a portal target)
  // must not replace a working featured example with an error callout (#405).
  const liveMountFailed = $derived(mountErrors[LIVE_MOUNT_CONTAINER_ID] !== undefined);

  // --- Sections + scroll spy (data-driven) ------------------------------
  type SectionDescriptor = { id: string; num: string; label: string };

  const sections = $derived.by<SectionDescriptor[]>(() => {
    if (documentation === null) return [];
    const list: SectionDescriptor[] = [{ id: 'overview', num: '01', label: 'Overview' }];
    if (
      documentation.component.useWhen.length > 0 ||
      documentation.component.avoidWhen.length > 0
    ) {
      list.push({ id: 'guidance', num: '', label: 'When to use' });
    }
    // No 'Playground' entry: the controls live in the persistent preview pane
    // beside the prose now, not as a section you scroll to. A TOC link would
    // point at an anchor that no longer exists.
    if (examples.length > 0) list.push({ id: 'examples', num: '', label: 'Examples' });
    if (propRows.length > 0) list.push({ id: 'props', num: '', label: 'Props' });
    if (documentation.component.a11y !== undefined) {
      list.push({ id: 'accessibility', num: '', label: 'Accessibility' });
    }
    if (documentation.component.related.length > 0) {
      list.push({ id: 'related', num: '', label: 'Related' });
    }
    // Renumber sequentially so the visible index always runs 01, 02, 03…
    return list.map((section, index) => ({
      ...section,
      num: String(index + 1).padStart(2, '0'),
    }));
  });

  // Section id → display number, derived once so each section header reads its
  // own number with an O(1) lookup instead of re-scanning `sections` by id.
  const sectionNumber = $derived(new Map(sections.map((section) => [section.id, section.num])));

  let activeSection = $state('overview');

  function prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function goToSection(id: string): (event: MouseEvent) => void {
    return (event: MouseEvent) => {
      event.preventDefault();
      const element = document.getElementById(id);
      if (element === null) return;
      const top = element.getBoundingClientRect().top + window.scrollY - (TOP_BAR_HEIGHT + 24);
      // `behavior: 'smooth'` is JS-driven, so the CSS reduced-motion rule does
      // not gate it — honor the preference explicitly with an instant jump.
      window.scrollTo({ top, behavior: prefersReducedMotion() ? 'instant' : 'smooth' });
    };
  }

  // Wire the scroll-spy listener. Reads the data-driven `sections` so it never
  // tracks a section that was omitted; the pure calculator does the math.
  $effect(() => {
    const ids = sections.map((section) => section.id);
    if (ids.length === 0) return;
    let ticking = false;
    let rafHandle: ReturnType<typeof requestAnimationFrame> | undefined;

    const compute = (): void => {
      ticking = false;
      rafHandle = undefined;
      const offsets: SectionOffset[] = [];
      for (const id of ids) {
        const element = document.getElementById(id);
        if (element === null) continue;
        offsets.push({ id, top: element.getBoundingClientRect().top + window.scrollY });
      }
      const next = computeActiveSection(
        offsets,
        window.scrollY,
        window.innerHeight,
        document.body.scrollHeight,
        TOP_BAR_HEIGHT + 96,
      );
      if (next !== null) activeSection = next;
    };

    const onScroll = (): void => {
      if (ticking) return;
      ticking = true;
      rafHandle = requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      // Cancel any frame still queued so a stale `compute` from this (now
      // torn-down) effect run can't write `activeSection` after re-run.
      if (rafHandle !== undefined) cancelAnimationFrame(rafHandle);
    };
  });

  // --- Raw artifacts (lazy, sticky-open) --------------------------------
  let hasOpenedRawArtifacts = $state(false);

  function jsonBlock(value: JsonValue | null): string {
    return JSON.stringify(value, null, 2);
  }
</script>

{#if previewOnly}
  <div
    class="canonical-preview"
    data-component-preview
    {@attach createEventSource(() => liveReloadUrl, {
      debounceMs: 100,
      events: { reload: handleLiveReload },
    })}
  >
    {#if overviewExample === undefined}
      <h1 class="snapshot-empty-heading">{humanizeComponentName(componentName)}</h1>
    {:else}
      <div
        class="example-preview"
        id="canonical-preview-mount-{overviewExample.scenario}"
        {@attach mountScenario(overviewExample.scenario)}
      ></div>
    {/if}
  </div>
{:else if snapshotMode}
  <!-- Snapshot mode (`?snapshot=1`): the visual-regression / a11y test harness
       loads this route and screenshots / axe-scans the page, expecting a clean
       single mount of each example with no docs chrome (matching the prior
       examples-only snapshot). Rendering the full page here would add README
       Shiki code blocks (low-contrast tokens), the hero, scroll-spy, etc. to
       every component's snapshot — so we render only the example mounts. -->
  <div
    class="snapshot-examples"
    data-component-page
    {@attach createEventSource(() => liveReloadUrl, {
      debounceMs: 100,
      events: { reload: handleLiveReload },
    })}
  >
    {#if examples.length === 0}
      <!-- Components without `*.example.svelte` files have nothing to mount. The
           test harness still waits for `#app > *` to be VISIBLE (non-zero box)
           before running axe, so an empty container would resolve to `hidden`
           and time out. Render a visible, axe-clean heading so the snapshot has
           deterministic, contrast-safe content. -->
      <h1 class="snapshot-empty-heading">{humanizeComponentName(componentName)}</h1>
    {:else}
      {#each examples as { scenario } (scenario)}
        <div
          class="example-preview"
          id="example-mount-{scenario}"
          {@attach mountScenario(scenario)}
        ></div>
      {/each}
    {/if}
  </div>
{:else}
  <!-- Sidebar navigation. Lives inside the documentation page's own tree — this
       is the single canonical page, so there is no outer shell to own it, and
       keeping it here means one hydration root rather than coordinating a
       shared shell bundle with this per-component one.

       Rendered only when entries are supplied, which excludes the snapshot and
       preview surfaces (their harnesses assert on a bare `#app`). -->
  <!-- One wrapper so this branch has a single root. Two siblings here (nav +
       page) trip happy-dom's fragment handling in the documentation tests. -->
  <div
    class="dx-shell"
    {@attach createEventSource(() => liveReloadUrl, {
      debounceMs: 100,
      events: { reload: handleLiveReload },
    })}
  >
    {@render overlays?.()}
    <div
      class={[
        'dx',
        sidebarComponents.length > 0 && 'dx--with-sidebar',
        isFocusMode && 'is-focus-mode',
      ]}
      data-component-page
    >
      <!-- ===== Top bar ===== -->

      {#if isLanding}
        <!-- Landing: the README in the prose column, same chrome as every
             component page. No hero, TOC, or preview pane — there is no
             component to describe or mount. -->
        <div class="dx-hero">
          <div class="dx__inner">
            <div class="dx-eyebrow">
              <span class="dx-eyebrow__index">Design system</span>
              <span class="dx-eyebrow__rule" aria-hidden="true"></span>
            </div>
            <h1 id="landing-title">cinder</h1>
            <p class="dx-hero__lede">
              Components for product interfaces. Browse runnable examples, inspect component
              contracts, and use the README as the starting point for installing and shipping
              Cinder.
            </p>
            <p class="dx-hero__meta">
              <a class="dx-landing-cta" href={buildComponentHref(sidebarComponents[0] ?? 'button')}>
                Browse components
              </a>
            </p>
          </div>
        </div>

        <div class="dx__inner">
          <main class="dx-content dx-content--landing">
            <div class="dx-prose readme-content">{@html readmeHtml}</div>
          </main>
        </div>
      {:else if documentationError !== null}
        <div class="dx__inner dx-error-region">
          <Alert variant="danger">
            Could not load documentation: {documentationError}
          </Alert>
        </div>
      {:else if documentation !== null}
        {@const component = documentation.component}

        <!-- ===== Hero ===== -->
        <div class="dx-hero">
          <div class="dx__inner">
            <div class="dx-hero__grid">
              <div>
                <div class="dx-eyebrow">
                  <span class="dx-eyebrow__index">{component.categoryLabel}</span>
                  <span class="dx-eyebrow__rule" aria-hidden="true"></span>
                </div>
                <h1 id="component-name">{component.name}</h1>
                <p class="dx-hero__lede">{component.purpose}</p>
                <div class="dx-hero__meta">
                  <div class="dx-import">
                    <span class="dx-import__code">
                      {#if highlightedImportStatement !== ''}
                        {@html highlightedImportStatement}
                      {:else}
                        {importStatement}
                      {/if}
                    </span>
                    <Tooltip text={importCopied ? 'Copied' : 'Copy import'}>
                      <button
                        type="button"
                        class="dx-import__copy"
                        data-copied={importCopied ? '' : undefined}
                        aria-label={importCopied ? 'Copied import' : 'Copy import'}
                        onclick={copyImport}
                      >
                        {#if importCopied}
                          <Check size={14} strokeWidth={1.5} aria-hidden="true" />
                        {:else}
                          <Copy size={14} strokeWidth={1.5} aria-hidden="true" />
                        {/if}
                      </button>
                    </Tooltip>
                  </div>
                  {#if component.tags.length > 0}
                    <div class="dx-tags">
                      {#each component.tags as tag (tag)}
                        <Badge variant="neutral" size="sm">{tag}</Badge>
                      {/each}
                    </div>
                  {/if}
                </div>
              </div>

              <aside class="dx-spec" aria-label="Component facts">
                <div class="dx-spec__row">
                  <span class="dx-spec__key">Status</span>
                  <span class="dx-spec__val">
                    <!-- The adjacent Badge is the accessible status text. The dot
                       is a redundant color cue, so mark it decorative — otherwise
                       its role="img" name re-announces the same word the Badge
                       already speaks (the audible half of #388). -->
                    <StatusDot status={statusDotStatus(component.status)} aria-hidden="true" />
                    <Badge variant={statusBadgeVariant(component.status)} size="sm">
                      {component.status}
                    </Badge>
                  </span>
                </div>
                <div class="dx-spec__row">
                  <span class="dx-spec__key">Category</span>
                  <span class="dx-spec__val">{component.categoryLabel}</span>
                </div>
                {#if component.a11y?.pattern !== undefined}
                  <div class="dx-spec__row">
                    <span class="dx-spec__key">A11y pattern</span>
                    <span class="dx-spec__val">{component.a11y.pattern}</span>
                  </div>
                {/if}
                <div class="dx-spec__row">
                  <span class="dx-spec__key">Export</span>
                  <span class="dx-spec__val dx-spec__val--monospace">{component.exportName}</span>
                </div>
                <div class="dx-spec__row">
                  <span class="dx-spec__key">Version</span>
                  <span class="dx-spec__val dx-spec__val--monospace"
                    >v{component.packageVersion}</span
                  >
                </div>
              </aside>
            </div>
          </div>
        </div>

        <!-- ===== Layout: Documentation / Playground ===== -->
        <div class="dx__inner">
          <div class="dx-views" role="tablist" aria-label="Component views">
            <button
              type="button"
              class="dx-views__tab"
              role="tab"
              id="view-tab-documentation"
              aria-selected={activeView === 'documentation'}
              {...activeView === 'documentation'
                ? { 'aria-controls': 'view-panel-documentation' }
                : {}}
              tabindex={activeView === 'documentation' ? 0 : -1}
              onclick={() => selectView('documentation')}
              onkeydown={onViewTabKeydown}
            >
              Documentation
            </button>
            <button
              type="button"
              class="dx-views__tab"
              role="tab"
              id="view-tab-playground"
              aria-selected={activeView === 'playground'}
              {...activeView === 'playground' ? { 'aria-controls': 'view-panel-playground' } : {}}
              tabindex={activeView === 'playground' ? 0 : -1}
              onclick={() => selectView('playground')}
              onkeydown={onViewTabKeydown}
            >
              Playground
            </button>
          </div>
          {#if activeView === 'playground'}
            <!-- Playground view: a real stage with room beside it for the props
                 panel. Previously this lived in a 38rem rail pinned next to the
                 prose, which starved both — the stage was too narrow to show a
                 wide component and the prose column was too narrow to read. -->
            <div
              class="dx-playground"
              role="tabpanel"
              id="view-panel-playground"
              aria-labelledby="view-tab-playground"
            >
              <div class="dx-playground__stage">
                <!-- Stage controls. Width simulation and focus mode used to live on
                     the shell's top bar and act on an iframe; they now sit with the
                     stage they resize, and work by constraining a plain container. -->
                {#if hasGeneratedControls || hasFocusablePreview || isFocusMode}
                  <div
                    class="dx-viewport"
                    role="group"
                    aria-label={hasGeneratedControls ? 'Stage width' : 'Preview controls'}
                  >
                    {#if hasGeneratedControls}
                      <div class="dx-viewport__sizes">
                        {#each PREVIEW_WIDTHS as option (option.label)}
                          <button
                            type="button"
                            class="dx-viewport__size"
                            aria-pressed={previewWidth === option.width}
                            onclick={() => (previewWidth = option.width)}
                          >
                            {option.label}
                          </button>
                        {/each}
                      </div>
                      <span class="dx-viewport__readout" aria-live="polite">
                        {previewWidth === null ? 'Full' : `${previewWidth}px`}
                      </span>
                    {/if}
                    <button
                      type="button"
                      class="dx-viewport__expand"
                      aria-pressed={isFocusMode}
                      onclick={() => (isFocusMode = !isFocusMode)}
                    >
                      {isFocusMode ? 'Exit' : 'Expand'}
                    </button>
                  </div>
                {/if}
                <!-- Single wrapper: a branch with several top-level children trips
                       happy-dom's fragment handling in the documentation tests.

                       Rendered UNCONDITIONALLY. Whether a snippet can be
                       synthesized from the props is a question about the
                       SNIPPET — it is not a reason to withhold the preview or
                       featured example. Gating the whole block
                       on it is what deleted the entire Playground section for
                       ~20 components and told each of them, falsely, that it had
                       no adjustable props. See `canGenerateFromProps`. -->
                <!-- When the bare component resolves from the page bundle, mount it
               directly with the synthesized prop values so the preview
               re-renders as the controls change — a genuine "Live preview"
               (#405). `mountLivePreview` re-runs its attachment on every
               `playgroundValues` change. The stage is gated off under
               `?snapshot=1`: the browser tests count `example-mount-*`
               selectors and run axe against a fixed surface, so a live mount
               must not appear there (see snapshot-mode contract).

               If the bare mount FAILS and a featured example exists, the
               `liveMountFailed` guard falls through to the featured branch
               rather than show an error callout over what would otherwise be
               a working preview. With no featured fallback, the live branch
               stays and surfaces the error — better than a blank section. -->
                <!-- `isHydrated` keeps the live mount off the server's tree: it
               needs `bareComponentModule`, which only the client bundle
               supplies. Without the gate the server would render the
               featured-example branch and the client the live branch on
               its hydration pass — a mismatch. The live preview swaps in
               immediately after mount. -->
                {#if isHydrated && bareComponent !== undefined && !snapshotMode && canGenerateFromProps && (!liveMountFailed || overviewExample === undefined)}
                  {#snippet previewChildren()}
                    {#if previewRecipe?.childrenHtml !== undefined}
                      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                      {@html previewRecipe.childrenHtml}
                    {:else if playgroundChildrenText !== ''}
                      {playgroundChildrenText}
                    {/if}
                  {/snippet}
                  <div class="dx-stage">
                    <div class="dx-stage__bar">
                      <span class="dx-stage__dot" aria-hidden="true"></span>
                      <span class="dx-stage__label">Live preview</span>
                    </div>
                    <div class="dx-stage__canvas" role="region" aria-label="Preview" tabindex="0">
                      {#if previewRecipe?.referenceHtml !== undefined}
                        <!-- A styling primitive is invisible without something to
                               be compared against. -->
                        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
                        {@html previewRecipe.referenceHtml}
                      {/if}
                      {#if mountErrors[LIVE_MOUNT_CONTAINER_ID] !== undefined}
                        {@const error = mountErrors[LIVE_MOUNT_CONTAINER_ID]}
                        <Callout variant="danger" title="This preview failed to render">
                          <p>{error?.message}</p>
                        </Callout>
                      {/if}
                      <div
                        class="example-preview"
                        id={LIVE_MOUNT_CONTAINER_ID}
                        {@attach mountLivePreview(
                          bareComponent,
                          toMountProps(
                            playgroundModel.controls,
                            $state.snapshot(playgroundValues),
                            playgroundModel.seeds,
                            previewRecipe,
                            previewChildren,
                          ),
                        )}
                      ></div>
                    </div>
                    <p class="dx-stage__note">
                      Renders with the props below. Adjust the controls to update it live.
                    </p>
                  </div>
                {:else if overviewExample !== undefined && !snapshotMode}
                  <!-- Fallback when the bare component can't be resolved (older
                 page bundle, or a component whose default/named export isn't
                 a constructor): mount the static featured example so the
                 section still shows a rendered instance (#374), labelled
                 honestly since only the snippet is prop-driven here. -->
                  <div class="dx-stage">
                    <div class="dx-stage__bar">
                      <span class="dx-stage__dot" aria-hidden="true"></span>
                      <span class="dx-stage__label">Featured example</span>
                    </div>
                    <div class="dx-stage__canvas" role="region" aria-label="Preview" tabindex="0">
                      {#if mountErrors[`playground-mount-${overviewExample.scenario}`] !== undefined}
                        {@const error = mountErrors[`playground-mount-${overviewExample.scenario}`]}
                        <Callout variant="danger" title="This preview failed to render">
                          <p>{error?.message}</p>
                        </Callout>
                      {/if}
                      <div
                        class="example-preview"
                        id="playground-mount-{overviewExample.scenario}"
                        {@attach mountScenario(overviewExample.scenario)}
                      ></div>
                    </div>
                    <p class="dx-stage__note">
                      {canGenerateFromProps
                        ? 'Shows the featured example. Adjust the controls to update the snippet.'
                        : 'Shows the featured example.'}
                    </p>
                  </div>
                {:else if !snapshotMode && composesInto !== undefined}
                  <!-- Compound PARTS have no live mount (they throw without
                 their provider) and ship no examples of their own, so
                 every other branch leaves them a permanently empty
                 frame. Point at the root instead: that page documents
                 the composition this component exists for. -->
                  <div class="dx-stage" data-stage-composed>
                    <div class="dx-stage__bar">
                      <span class="dx-stage__dot" aria-hidden="true"></span>
                      <span class="dx-stage__label">Composed component</span>
                    </div>
                    <div class="dx-stage__canvas" role="region" aria-label="Preview" tabindex="0">
                      <p class="dx-stage__compose">
                        {documentation.component.name} is composed inside
                        <a href={buildComponentHref(composesInto)} target="_top">
                          {humanizeComponentName(composesInto)}
                        </a>, which supplies the context it reads. Its page shows the whole
                        composition running.
                      </p>
                    </div>
                  </div>
                {:else if !snapshotMode && canGenerateFromProps && canMountBare}
                  <!-- Reserve the stage for components with NO examples (label,
                 statistic, …). Without this branch the server renders
                 nothing here, and hydration then INSERTS the whole live
                 stage into an already-painted page — a layout shift, and
                 the opposite of the reservation the server entry
                 promises.

                 Gated on `canMountBare`, which is exactly the set whose
                 bare mount the client will resolve. Compound roots and
                 context-requiring parts keep `bareComponent` undefined on
                 purpose, so reserving a box they never fill would leave
                 an empty frame. Both inputs come from the manifest, so
                 the server can make this call. -->
                  <div class="dx-stage" data-stage-reserved>
                    <div class="dx-stage__bar">
                      <span class="dx-stage__dot" aria-hidden="true"></span>
                      <span class="dx-stage__label">Live preview</span>
                    </div>
                    <div
                      class="dx-stage__canvas"
                      role="region"
                      aria-label="Preview"
                      tabindex="0"
                    ></div>
                    <p class="dx-stage__note">
                      Renders with the props below. Adjust the controls to update it live.
                    </p>
                  </div>
                {/if}
              </div>
              <aside class="dx-playground__panel" aria-label="Props">
                <!-- The snippet is the one piece a synthesis failure really
                         does invalidate: with an unsatisfiable required prop it
                         would not compile if pasted. Withhold IT, and say why
                         below — rather than withholding the whole section. -->
                {#if canGenerateFromProps}
                  <CodeBlock
                    highlighter={depictHighlighter}
                    code={playgroundSnippet}
                    language="svelte"
                    copyable
                  />
                {/if}
                {#if playgroundNote !== null}
                  <p class="dx-play__note">
                    {#if playgroundNote.kind === 'example-only'}
                      {#if playgroundNote.reason === 'structured-children'}
                        This component is documented through its examples — it requires structured
                        child composition the playground can't synthesize.
                      {:else}
                        This component is documented through its examples — its behavior depends on
                        data, callbacks, or an anchored interaction the playground can't synthesize.
                      {/if}
                    {:else if playgroundNote.kind === 'unsatisfied'}
                      No generated snippet:
                      <code>{playgroundNote.props.join(', ')}</code>
                      {playgroundNote.props.length === 1
                        ? "is a required prop the playground can't synthesize a value for."
                        : "are required props the playground can't synthesize values for."}
                      {playgroundNote.hasFallback
                        ? 'The featured example above is a real, working instance.'
                        : ''}
                    {:else}
                      This component has no adjustable props. See the examples for usage.
                    {/if}
                  </p>
                {/if}
                {#if canGenerateFromProps && playgroundModel.skipped.length > 0}
                  <p class="dx-play__skipped">
                    Not adjustable here: {playgroundModel.skipped.join(', ')}.
                  </p>
                {/if}
                {#if canGenerateFromProps && playgroundModel.seeds.length > 0}
                  <div class="dx-play__seeds">
                    <div class="dx-play__controls-head">Supplied values</div>
                    {#each playgroundModel.seeds as seed (seed.name)}
                      <div class="dx-seed">
                        <div class="dx-seed__name">{seed.name}</div>
                        <code class="dx-seed__value">{seed.source}</code>
                      </div>
                    {/each}
                    <p class="dx-play__note">
                      Placeholder data, so the preview renders a real instance. Not adjustable here
                      — the snippet above copies with these values.
                    </p>
                  </div>
                {/if}
                {#if hasGeneratedControls}
                  <div class="dx-play__controls">
                    <div class="dx-play__controls-head">
                      <Sliders size={13} strokeWidth={1.5} aria-hidden="true" />
                      Props
                    </div>
                    {#each playgroundModel.controls as control (control.name)}
                      <div class={['dx-ctl', control.kind === 'boolean' && 'dx-ctl--inline']}>
                        <div class="dx-ctl__text">
                          <div class="dx-ctl__name" title={control.name}>{control.name}</div>
                          {#if control.description !== undefined}
                            <div class="dx-ctl__desc">
                              {@html renderPropDescription(control.description)}
                            </div>
                          {/if}
                        </div>
                        {#if control.kind === 'boolean'}
                          <Toggle
                            id="pg-{control.name}"
                            label={control.name}
                            labelVisible={false}
                            bind:checked={
                              () => Boolean(playgroundValues[control.name]),
                              (next) => (playgroundValues[control.name] = next)
                            }
                          />
                        {:else if control.kind === 'select'}
                          <select
                            class="dx-ctl__select"
                            aria-label={control.name}
                            value={String(playgroundValues[control.name] ?? control.value)}
                            onchange={(event) =>
                              (playgroundValues[control.name] = (
                                event.currentTarget as HTMLSelectElement
                              ).value)}
                          >
                            {#each control.options as option (option)}
                              <option value={option}>{option}</option>
                            {/each}
                          </select>
                        {:else if control.kind === 'number'}
                          <input
                            class="dx-ctl__input"
                            type="number"
                            aria-label={control.name}
                            value={Number(playgroundValues[control.name] ?? control.value)}
                            oninput={(event) =>
                              (playgroundValues[control.name] = Number(
                                (event.currentTarget as HTMLInputElement).value,
                              ))}
                          />
                        {:else}
                          <input
                            class="dx-ctl__input"
                            type="text"
                            aria-label={control.name}
                            value={String(playgroundValues[control.name] ?? control.value)}
                            oninput={(event) =>
                              (playgroundValues[control.name] = (
                                event.currentTarget as HTMLInputElement
                              ).value)}
                          />
                        {/if}
                      </div>
                    {/each}
                  </div>
                {/if}
              </aside>
            </div>
          {:else}
            <div
              class="dx-layout"
              role="tabpanel"
              id="view-panel-documentation"
              aria-labelledby="view-tab-documentation"
            >
              <nav class="dx-toc" aria-label="On this page">
                <ul class="dx-toc__list">
                  {#each sections as section (section.id)}
                    <li>
                      <a
                        class="dx-toc__link"
                        href="#{section.id}"
                        data-active={activeSection === section.id ? '' : undefined}
                        aria-current={activeSection === section.id ? 'location' : undefined}
                        onclick={goToSection(section.id)}
                      >
                        <span class="dx-toc__num">{section.num}</span>
                        <span>{section.label}</span>
                      </a>
                    </li>
                  {/each}
                </ul>
              </nav>

              <main class="dx-content">
                <!-- -- Overview -- -->
                <section id="overview" class="dx-section">
                  <div class="dx-section__head">
                    <span class="dx-section__num">01</span>
                    <h2 class="dx-section__title">Overview</h2>
                    <span class="dx-section__rule" aria-hidden="true"></span>
                  </div>
                  <div class="dx-prose readme-content">
                    {#each splitReadmeHtml(documentation.readme.html) as segment, i (i)}
                      {#if segment.type === 'html'}
                        {@html segment.content}
                      {:else}
                        {@const block = documentation.readme.codeBlocks[segment.index]}
                        {#if block !== undefined}
                          <CodeBlock
                            highlighter={depictHighlighter}
                            code={block.value}
                            language={block.language ?? 'plaintext'}
                            copyable
                          />
                        {:else}
                          <div class="readme-pre-fallback">{@html segment.fallbackHtml}</div>
                        {/if}
                      {/if}
                    {/each}
                  </div>
                  {#if overviewExample !== undefined}
                    <div class="dx-stage">
                      <div class="dx-stage__bar">
                        <span class="dx-stage__dot" aria-hidden="true"></span>
                        <span class="dx-stage__label">Live preview</span>
                      </div>
                      <div
                        class="dx-stage__canvas"
                        role="region"
                        aria-label="Overview preview"
                        tabindex="0"
                      >
                        {#if mountErrors[`overview-mount-${overviewExample.scenario}`] !== undefined}
                          {@const error = mountErrors[`overview-mount-${overviewExample.scenario}`]}
                          <Callout variant="danger" title="This preview failed to render">
                            <p>{error?.message}</p>
                          </Callout>
                        {/if}
                        <div
                          class="example-preview"
                          id="overview-mount-{overviewExample.scenario}"
                          {@attach mountScenario(overviewExample.scenario)}
                        ></div>
                      </div>
                    </div>
                  {/if}
                </section>

                <!-- -- Guidance -- -->
                {#if component.useWhen.length > 0 || component.avoidWhen.length > 0}
                  <section id="guidance" class="dx-section">
                    <div class="dx-section__head">
                      <span class="dx-section__num">{sectionNumber.get('guidance') ?? ''}</span>
                      <h2 class="dx-section__title">When to use</h2>
                      <span class="dx-section__rule" aria-hidden="true"></span>
                    </div>
                    <div class="dx-guide">
                      {#if component.useWhen.length > 0}
                        <div class="dx-guide__card">
                          <div class="dx-guide__head">
                            <span class="dx-guide__icon dx-guide__icon--use">
                              <Check size={16} strokeWidth={1.5} aria-hidden="true" />
                            </span>
                            Use when
                          </div>
                          <ul class="dx-guide__list dx-guide__list--use">
                            {#each component.useWhen as item, index (index)}
                              <li>
                                <Check size={15} strokeWidth={1.5} aria-hidden="true" />
                                <span>{item}</span>
                              </li>
                            {/each}
                          </ul>
                        </div>
                      {/if}
                      {#if component.avoidWhen.length > 0}
                        <div class="dx-guide__card">
                          <div class="dx-guide__head">
                            <span class="dx-guide__icon dx-guide__icon--avoid">
                              <X size={16} strokeWidth={1.5} aria-hidden="true" />
                            </span>
                            Avoid when
                          </div>
                          <ul class="dx-guide__list dx-guide__list--avoid">
                            {#each component.avoidWhen as item, index (index)}
                              <li>
                                <X size={15} strokeWidth={1.5} aria-hidden="true" />
                                <span>
                                  {item.reason}
                                  {#if item.alternative !== undefined}
                                    <a
                                      class="dx-guide__alt"
                                      href={buildComponentHref(item.alternative)}
                                      target="_top"
                                    >
                                      Use {humanizeComponentName(item.alternative)} instead
                                    </a>
                                  {/if}
                                </span>
                              </li>
                            {/each}
                          </ul>
                        </div>
                      {/if}
                    </div>
                  </section>
                {/if}

                <!-- -- Examples -- -->
                {#if examples.length > 0}
                  <section id="examples" class="dx-section">
                    <div class="dx-section__head">
                      <span class="dx-section__num">{sectionNumber.get('examples') ?? ''}</span>
                      <h2 class="dx-section__title">Examples</h2>
                      <span class="dx-section__rule" aria-hidden="true"></span>
                    </div>
                    <div class="dx-examples">
                      {#each examples as { scenario, title, description } (scenario)}
                        {@const disclosure = disclosureFor(exampleDisclosures, scenario)}
                        {@const source = fetchedSource[scenario]}
                        {@const mountError = mountErrors[`example-mount-${scenario}`]}
                        {@const sourceError = sourceErrors[scenario]}
                        {#if disclosure}
                          <section id="example-card-{scenario}" class="dx-example">
                            <div class="dx-example__head">
                              <div>
                                <h3 class="dx-example__title">{title}</h3>
                                {#if description !== undefined}
                                  <p class="dx-example__desc">{description}</p>
                                {/if}
                              </div>
                            </div>
                            <div class="dx-example__body">
                              <div class="dx-stage">
                                <div
                                  class="dx-stage__canvas"
                                  role="region"
                                  aria-label={`${title} preview`}
                                  tabindex="0"
                                >
                                  <div
                                    class="example-preview"
                                    id="example-mount-{scenario}"
                                    {@attach mountScenario(scenario)}
                                  ></div>
                                </div>
                              </div>

                              {#if mountError !== undefined}
                                <Callout variant="danger" title="This example failed to render">
                                  <p class="example-error__message">{mountError.message}</p>
                                  {#if mountError.stack !== undefined}
                                    <pre
                                      class="example-error__stack"
                                      aria-label="Stack trace">{mountError.stack}</pre>
                                  {/if}
                                  <div class="example-error__actions">
                                    <Button
                                      size="sm"
                                      variant="secondary"
                                      aria-label="Copy error for {title}"
                                      onclick={() => copyErrorToClipboard(mountError)}
                                    >
                                      Copy error
                                    </Button>
                                  </div>
                                </Callout>
                              {/if}

                              <Accordion bind:expandedIds={disclosure.expandedIds}>
                                <AccordionItem id={`source-${scenario}`} title="Show code">
                                  {#if loadingSource[scenario]}
                                    <p class="source-loading">Loading…</p>
                                  {:else if source === null}
                                    <Callout variant="danger" title="Could not load source">
                                      <dl class="example-error__detail">
                                        <dt>Requested</dt>
                                        <dd>
                                          <code>
                                            {sourceError?.url ??
                                              `/example-src/${componentName}/${scenario}`}
                                          </code>
                                        </dd>
                                        <dt>Reason</dt>
                                        <dd>{sourceError?.detail ?? 'Unknown error'}</dd>
                                      </dl>
                                      <div class="example-error__actions">
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          aria-label="Retry loading source for {title}"
                                          onclick={() =>
                                            fetchExampleSource(componentName, scenario, {
                                              fetchedSource,
                                              loadingSource,
                                              sourceErrors,
                                            })}
                                        >
                                          Retry
                                        </Button>
                                      </div>
                                    </Callout>
                                  {:else if source !== undefined}
                                    <CodeBlock
                                      highlighter={depictHighlighter}
                                      code={source}
                                      language="svelte"
                                      copyable
                                    />
                                  {/if}
                                </AccordionItem>
                              </Accordion>
                            </div>
                          </section>
                        {/if}
                      {/each}
                    </div>
                  </section>
                {/if}

                <!-- -- Props -- -->
                {#if propRows.length > 0}
                  <section id="props" class="dx-section props-section">
                    <div class="dx-section__head">
                      <span class="dx-section__num">{sectionNumber.get('props') ?? ''}</span>
                      <h2 class="dx-section__title">Props</h2>
                      <span class="dx-section__rule" aria-hidden="true"></span>
                    </div>
                    <!-- tabindex makes the scroll region keyboard-accessible (WCAG 2.1.1). -->
                    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
                    <div
                      class={['props-table-scroll', { 'is-scrollable': propsTableOverflows }]}
                      role="region"
                      aria-label="Props for {componentName}"
                      tabindex="0"
                      {@attach (element) =>
                        scrollOverflowSentinel(
                          element,
                          (overflows) => (propsTableOverflows = overflows),
                        )}
                    >
                      <Table caption={`Props for ${componentName}`} density="condensed">
                        <Table.Header>
                          <Table.Row>
                            {#each PROP_COLUMNS as column (column.key)}
                              <Table.HeaderCell scope="col">{column.label}</Table.HeaderCell>
                            {/each}
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          {#each propRows as prop (prop.name)}
                            <Table.Row>
                              <Table.Cell data-label="Name">
                                <span class="props-name-cell">
                                  <code class="props-name">{prop.name}</code>
                                  <!-- `required` and `bindable` are BADGES on the
                                       name now, not columns. As columns they cost
                                       two of six columns to say "no" with an
                                       em-dash on most rows, and in the stacked
                                       layout they became two more labelled lines
                                       per prop. Spelled in full because the
                                       column header that used to name them is
                                       gone — an unexplained "req" is a worse
                                       trade than four extra characters. -->
                                  {#if prop.required}
                                    <span class="dx-prop-flag dx-prop-flag--req">required</span>
                                  {/if}
                                  {#if prop.bindable}
                                    <span class="dx-prop-flag dx-prop-flag--bind">bindable</span>
                                  {/if}
                                </span>
                              </Table.Cell>
                              <Table.Cell data-label="Type">
                                {@const typeMembers = splitUnionType(prop.type)}
                                {#if typeMembers.length === 1 || isShortUnion(typeMembers)}
                                  {@const full = typeMembers.join(' | ')}
                                  {#if full.length > SINGLE_TYPE_PREVIEW_CHARS}
                                    <code class="props-type"
                                      >{full.slice(0, SINGLE_TYPE_PREVIEW_CHARS)}…</code
                                    >
                                    <details class="props-type__more">
                                      <summary>Show full type</summary>
                                      <code class="props-type">{full}</code>
                                    </details>
                                  {:else}
                                    <code class="props-type">{full}</code>
                                  {/if}
                                {:else}
                                  {@const compact = typeMembers.every((m) => m.length <= 12)}
                                  <code
                                    class={[
                                      'props-type',
                                      'props-type--union',
                                      compact && 'props-type--union-compact',
                                    ]}
                                  >
                                    {#each typeMembers.slice(0, UNION_PREVIEW_COUNT) as member, index (index)}
                                      <span class="props-type__member"
                                        >{#if index > 0}<span
                                            class="props-type__sep"
                                            aria-hidden="true">|</span
                                          >{/if}<span class="props-type__value">{member}</span
                                        ></span
                                      >
                                    {/each}
                                  </code>
                                  {#if typeMembers.length > UNION_PREVIEW_COUNT}
                                    <!-- A `<details>` SIBLING, never a child of
                                         `<code>`: `code` is phrasing content and
                                         `details` is flow content, so nesting it
                                         makes the parser reflow the tree. -->
                                    <details class="props-type__more">
                                      <summary
                                        >{typeMembers.length - UNION_PREVIEW_COUNT} more members</summary
                                      >
                                      <code class="props-type props-type--union">
                                        {#each typeMembers.slice(UNION_PREVIEW_COUNT) as member, index (index)}
                                          <span class="props-type__member"
                                            ><span class="props-type__sep" aria-hidden="true"
                                              >|</span
                                            ><span class="props-type__value">{member}</span></span
                                          >
                                        {/each}
                                      </code>
                                    </details>
                                  {/if}
                                {/if}
                              </Table.Cell>
                              <Table.Cell data-label="Default">
                                {#if prop.defaultValue !== undefined}
                                  <code class="props-default">{prop.defaultValue}</code>
                                {:else}
                                  <span class="props-dash" aria-hidden="true">—</span>
                                {/if}
                              </Table.Cell>
                              <Table.Cell data-label="Description">
                                {#if prop.description !== undefined}
                                  <span class="props-description"
                                    >{@html renderPropDescription(prop.description)}</span
                                  >
                                {:else}
                                  <span class="props-dash" aria-hidden="true">—</span>
                                {/if}
                              </Table.Cell>
                            </Table.Row>
                          {/each}
                        </Table.Body>
                      </Table>
                    </div>
                  </section>
                {/if}

                <!-- -- Accessibility -- -->
                {#if component.a11y !== undefined}
                  {@const a11y = component.a11y}
                  <section id="accessibility" class="dx-section">
                    <div class="dx-section__head">
                      <span class="dx-section__num">{sectionNumber.get('accessibility') ?? ''}</span
                      >
                      <h2 class="dx-section__title">Accessibility</h2>
                      <span class="dx-section__rule" aria-hidden="true"></span>
                    </div>
                    {#if a11y.pattern !== undefined}
                      <div class="dx-a11y-alert">
                        <Alert variant="info">
                          {#snippet icon()}
                            <Accessibility size={18} strokeWidth={1.5} aria-hidden="true" />
                          {/snippet}
                          Implements the {a11y.pattern} pattern.
                        </Alert>
                      </div>
                    {/if}
                    <div class="dx-a11y">
                      {#if a11y.keyboard !== undefined && a11y.keyboard.length > 0}
                        <div class="dx-keys">
                          {#each a11y.keyboard as shortcut, index (index)}
                            <div class="dx-keys__row">
                              <div class="dx-keys__key-list">
                                {#each shortcut.keys.split(/\s+\/\s+/) as key, keyIndex (keyIndex)}
                                  {#if keyIndex === 0}
                                    <Kbd label={key} />
                                  {:else}
                                    <span class="dx-keys__alternative">
                                      <span class="dx-keys__separator">/</span>
                                      <Kbd label={key} />
                                    </span>
                                  {/if}
                                {/each}
                              </div>
                              <div class="dx-keys__action">{shortcut.action}</div>
                            </div>
                          {/each}
                        </div>
                      {/if}
                      {#if a11y.notes !== undefined && a11y.notes.length > 0}
                        <div class="dx-notes">
                          {#each a11y.notes as note, index (index)}
                            <div class="dx-note">
                              <ShieldCheck size={15} strokeWidth={1.5} aria-hidden="true" />
                              <span>{note}</span>
                            </div>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  </section>
                {/if}

                <!-- -- Related -- -->
                {#if component.related.length > 0}
                  <section id="related" class="dx-section">
                    <div class="dx-section__head">
                      <span class="dx-section__num">{sectionNumber.get('related') ?? ''}</span>
                      <h2 class="dx-section__title">Related</h2>
                      <span class="dx-section__rule" aria-hidden="true"></span>
                    </div>
                    <div class="dx-related">
                      {#each component.related as related (related)}
                        <a class="dx-rel" href={buildComponentHref(related)} target="_top">
                          <span class="dx-rel__top">
                            <span class="dx-rel__name">{related}</span>
                            <ArrowUpRight
                              class="dx-rel__arrow"
                              size={16}
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                          </span>
                        </a>
                      {/each}
                    </div>
                  </section>
                {/if}

                <!-- -- Raw artifacts (demoted from a primary tab) -- -->
                <section class="dx-section dx-raw">
                  <Collapsible
                    trigger="Raw artifacts"
                    onToggle={(open) => {
                      if (open) hasOpenedRawArtifacts = true;
                    }}
                  >
                    {#if hasOpenedRawArtifacts}
                      <div class="dx-raw__grid">
                        <div class="dx-raw__panel">
                          <h3>Manifest entry</h3>
                          <CodeBlock
                            highlighter={depictHighlighter}
                            code={jsonBlock(documentation.rawArtifacts.manifestEntry)}
                            language="json"
                            copyable
                          />
                        </div>
                        <div class="dx-raw__panel">
                          <h3>Schema</h3>
                          <CodeBlock
                            highlighter={depictHighlighter}
                            code={jsonBlock(documentation.rawArtifacts.schema)}
                            language="json"
                            copyable
                          />
                        </div>
                        <div class="dx-raw__panel">
                          <h3>Variables</h3>
                          <CodeBlock
                            highlighter={depictHighlighter}
                            code={jsonBlock(documentation.rawArtifacts.variables)}
                            language="json"
                            copyable
                          />
                        </div>
                        <div class="dx-raw__panel">
                          <h3>Constraints</h3>
                          <CodeBlock
                            highlighter={depictHighlighter}
                            code={jsonBlock(documentation.rawArtifacts.constraints)}
                            language="json"
                            copyable
                          />
                        </div>
                        <div class="dx-raw__panel">
                          <h3>Examples</h3>
                          <CodeBlock
                            highlighter={depictHighlighter}
                            code={jsonBlock(documentation.rawArtifacts.examples)}
                            language="json"
                            copyable
                          />
                        </div>
                      </div>
                    {/if}
                  </Collapsible>
                </section>
              </main>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Rendered LAST in the DOM on purpose. The nav is `position: fixed`, so its
         visual placement is unaffected, but source order IS tab order — ahead of
         the content it put ~170 link stops between a keyboard user and the
         documentation they came for. -->
    {#if sidebarComponents.length > 0}
      <!--
        Restores its own scroll offset. Selecting a component is a full document
        navigation, so without this the 170-link column snapped back to the top
        every time and the reader lost their place.

-->
      <nav class="dx-nav" aria-label="Components" {@attach persistScrollPosition}>
        <a class="dx-nav__brand" href="/">CINDER</a>
        <div class="dx-nav__filter">
          <label class="cinder-sr-only" for="sidebar-filter">Filter components</label>
          <input
            id="sidebar-filter"
            class="dx-nav__filter-input"
            type="search"
            autocomplete="off"
            placeholder="Filter components…"
            bind:value={navFilter}
          />
        </div>
        <ul class="dx-nav__list">
          {#each navigationGroups as group (group.name)}
            <li>
              <a
                class="dx-nav__link"
                href={buildComponentHref(group.name)}
                aria-current={group.name === componentName ? 'page' : undefined}
              >
                {humanizeComponentName(group.name)}
              </a>
              {#if group.children.length > 0}
                <ul class="dx-nav__sublist">
                  {#each group.children as child (child)}
                    <li>
                      <a
                        class="dx-nav__link dx-nav__link--child"
                        href={buildComponentHref(child)}
                        aria-current={child === componentName ? 'page' : undefined}
                      >
                        {humanizeComponentName(child)}
                      </a>
                    </li>
                  {/each}
                </ul>
              {/if}
            </li>
          {/each}
          {#if visibleComponents.length === 0}
            <li class="dx-nav__empty">No components match “{navFilter}”.</li>
          {/if}
        </ul>
        <!-- The two page actions live here, not in a top bar. The band they
             came from restated the sidebar brand, the hero eyebrow, and the
             page `<h1>` — three duplications and one row of chrome for two
             buttons. The sidebar renders on the landing page too, so the
             theme toggle stays reachable there. -->
        <div class="dx-nav__footer" role="toolbar" aria-label="Page controls">
          <Tooltip text="View source on GitHub" placement="bottom">
            <a
              class="dx-iconbtn"
              href="https://github.com/stevekinney/cinder"
              target="_blank"
              rel="noreferrer"
              aria-label="View source on GitHub"
            >
              <Github size={17} strokeWidth={1.5} aria-hidden="true" />
            </a>
          </Tooltip>
          <Tooltip text={themeToggleLabel} placement="bottom">
            <button
              type="button"
              class="dx-iconbtn"
              onclick={toggleTheme}
              aria-label={themeToggleLabel}
            >
              {#if theme === 'dark'}
                <Sun size={17} strokeWidth={1.5} aria-hidden="true" />
              {:else}
                <Moon size={17} strokeWidth={1.5} aria-hidden="true" />
              {/if}
            </button>
          </Tooltip>
          {@render toolbarActions?.()}
        </div>
      </nav>
    {/if}
  </div>
{/if}

<style>
  /* Page surface: pure white in light mode, the system surface in dark. Set
     LOCALLY on the page root via `light-dark()` (which follows `color-scheme`,
     the same switch cinder tokens use) so the global --cinder-bg token — and
     every other playground iframe — stays untouched. */
  .dx {
    --dx-gutter: clamp(1.25rem, 4vw, 3.5rem);
    /* Wider than the old single-column cap: the page now carries a prose column
       AND a preview column, and 78rem left the prose at ~544px. */
    --dx-max: 104rem;
    --dx-rail: 14.5rem;
    /* Preview column. Wide enough for real component layouts — the previous
       inline stage was a fixed 360px box, far too small for tables, editors,
       and anything with a sidebar of its own. */
    /* The top bar is gone — see `.dx-nav__footer`. Kept as a variable at zero
       rather than deleted, because every sticky offset and scroll-margin on the
       page is expressed as a `calc()` against it. */
    --dx-topbar-h: 0rem;
    min-height: 100vh;
    border: 1px solid var(--cinder-border);
    background: light-dark(oklch(100% 0 0), var(--cinder-bg));
  }

  /*
   * Component navigation. A plain list of links, deliberately built from bare
   * elements rather than the shell's Sidebar component: this page ships a
   * per-component bundle, and pulling cinder's navigation components in dragged
   * a second Svelte runtime (and the whole component barrel) along with them.
   * Links need neither.
   */
  /* Single root for the documentation branch; see the template comment. */
  .dx-shell {
    display: contents;
  }

  .dx-nav {
    position: fixed;
    inset-block: 0;
    inset-inline-start: 0;
    z-index: 20;
    width: 220px;
    overflow-y: auto;
    padding: var(--cinder-space-4) 0;
    border-inline-end: 1px solid var(--cinder-border);
    background: var(--cinder-surface-raised);
    display: flex;
    flex-direction: column;
  }

  .dx-nav__brand {
    display: block;
    padding: var(--cinder-space-2) var(--cinder-space-5) var(--cinder-space-4);
    color: var(--cinder-text);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    font-weight: var(--cinder-font-semibold);
    letter-spacing: 0.18em;
    text-decoration: none;
    text-transform: uppercase;
  }

  .dx-nav__filter {
    padding: 0 var(--cinder-space-4) var(--cinder-space-3);
  }

  .dx-nav__filter-input {
    appearance: none;
    width: 100%;
    padding: var(--cinder-space-2) var(--cinder-space-3);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-bg);
    color: var(--cinder-text);
    font-family: inherit;
    font-size: var(--cinder-text-sm);
  }

  .dx-nav__filter-input::placeholder {
    color: var(--cinder-text-subtle);
  }

  .dx-nav__filter-input:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  @media (forced-colors: active) {
    .dx-nav__filter-input:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      box-shadow: none;
    }
  }

  .dx-nav__empty {
    padding: var(--cinder-space-2) var(--cinder-space-5);
    color: var(--cinder-text-subtle);
    font-size: var(--cinder-text-sm);
  }

  .dx-nav__footer {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1-5, 0.375rem);
    padding: var(--cinder-space-3) var(--cinder-space-4);
    border-block-start: 1px solid var(--cinder-border-muted);
  }
  .dx-nav__list {
    flex: 1;
    display: flex;
    flex-direction: column;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .dx-nav__link {
    display: block;
    padding: var(--cinder-space-2) var(--cinder-space-5);
    border-inline-start: 2px solid transparent;
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-sm);
    text-decoration: none;
  }

  .dx-nav__sublist {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .dx-nav__link--child {
    padding-inline-start: var(--cinder-space-7);
    font-size: var(--cinder-text-xs);
  }

  @media (hover: hover) {
    .dx-nav__link:hover {
      background: var(--cinder-surface-hover);
      color: var(--cinder-text);
    }
  }

  .dx-nav__link[aria-current='page'] {
    border-inline-start-color: var(--cinder-accent);
    background: var(--cinder-surface-hover);
    color: var(--cinder-text);
    font-weight: var(--cinder-font-medium);
  }

  /* Focus-ring policy: transparent outline + the shared ring shadow, so forced-
     colors mode can still paint a real outline. See docs/focus-ring-policy.md. */
  .dx-nav__link:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  @media (forced-colors: active) {
    .dx-nav__link:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: calc(var(--cinder-ring-width) * -1);
      box-shadow: none;
    }
  }

  /*
   * The nav is fixed at the inline start with a 220px width, so the
   * documentation column reclaims that space.
   */
  .dx--with-sidebar {
    margin-inline-start: 220px;
  }

  /* Below the sidebar's breakpoint it becomes an off-canvas drawer, so the
     documentation column takes the full width again. */
  /* Narrow viewports: the nav becomes a normal block above the content rather
     than a fixed column, so the documentation gets the full width. */
  @media (max-width: 720px) {
    .dx-nav {
      position: static;
      width: auto;
      max-height: 40vh;
      border-inline-end: 0;
      border-block-end: 1px solid var(--cinder-border);
    }

    .dx--with-sidebar {
      margin-inline-start: 0;
    }
  }

  .dx__inner {
    max-width: var(--dx-max);
    margin-inline: auto;
    padding-inline: var(--dx-gutter);
    min-width: 0;
  }

  /* ===== Top bar ===== */
  .dx-iconbtn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: var(--cinder-radius-md);
    border: 1px solid transparent;
    background: transparent;
    color: var(--cinder-text-muted);
    cursor: pointer;
    transition:
      background 120ms ease,
      color 120ms ease,
      border-color 120ms ease;
  }
  @media (hover: hover) {
    .dx-iconbtn:hover {
      background: var(--cinder-surface-hover);
      color: var(--cinder-text);
      border-color: var(--cinder-border-muted);
    }
  }
  .dx-iconbtn:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }
  @media (forced-colors: active) {
    .dx-iconbtn:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: 3px;
      box-shadow: none;
    }
  }

  .dx-error-region {
    padding-block: var(--cinder-space-8);
  }

  /* ===== Hero ===== */
  .dx-hero {
    /* Halved. The hairline `border-block-end` below already terminates the hero,
       so the padding was doing the job twice — and it stacked with the layout's
       own top padding for ~96px of nothing between them. */
    padding-block: clamp(2rem, 5vw, 3.75rem) clamp(1.25rem, 2.5vw, 1.75rem);
    border-block-end: 1px solid var(--cinder-border-muted);
  }
  .dx-hero__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 19rem;
    gap: clamp(1.5rem, 4vw, 3.5rem);
    align-items: end;
  }
  .dx-eyebrow {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-3);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--cinder-text-subtle);
    margin-block-end: var(--cinder-space-5);
  }
  .dx-eyebrow__index {
    color: var(--cinder-accent-text);
  }
  .dx-eyebrow__rule {
    flex: 1;
    height: 1px;
    background: var(--cinder-border-muted);
  }
  .dx-hero h1 {
    font-size: clamp(2.5rem, 6vw, 3.75rem);
    line-height: 1.02;
    letter-spacing: -0.03em;
    font-weight: var(--cinder-font-semibold);
    color: var(--cinder-text);
    margin: 0;
    text-wrap: balance;
  }
  .dx-hero__lede {
    margin: var(--cinder-space-5) 0 0;
    font-size: clamp(var(--cinder-text-lg), 2.2vw, var(--cinder-text-2xl));
    line-height: var(--cinder-leading-snug);
    color: var(--cinder-text-muted);
    max-width: 34ch;
    text-wrap: pretty;
  }
  .dx-hero__meta {
    margin-block-start: var(--cinder-space-7);
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--cinder-space-2);
  }
  .dx-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--cinder-space-1-5, 0.375rem);
  }

  .dx-spec {
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    background: var(--cinder-surface-raised);
    box-shadow: var(--cinder-shadow-sm);
    overflow: hidden;
  }
  .dx-spec__row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-4);
    padding: var(--cinder-space-3) var(--cinder-space-4);
    font-size: var(--cinder-text-sm);
  }
  .dx-spec__row + .dx-spec__row {
    border-block-start: 1px solid var(--cinder-border-muted);
  }
  .dx-spec__key {
    color: var(--cinder-text-subtle);
    font-size: var(--cinder-text-xs);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .dx-spec__val {
    color: var(--cinder-text);
    font-weight: var(--cinder-font-medium);
    display: inline-flex;
    align-items: center;
    gap: var(--cinder-space-2);
  }
  .dx-spec__val--monospace {
    font-family: var(--cinder-font-mono);
    font-weight: var(--cinder-font-normal);
  }

  .dx-import {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-surface-inset);
    overflow: hidden;
    max-width: 100%;
  }
  .dx-import__code {
    display: inline-flex;
    align-items: center;
    padding: var(--cinder-space-2) var(--cinder-space-3);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* A real button affordance, not a bare icon hugging the code field's edge:
     a comfortable square hit target with its own raised surface, separated from
     the code by the divider border, and a clear hover state. */
  .dx-import__copy {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    inline-size: 2.25rem;
    min-block-size: 2.25rem;
    padding: 0 var(--cinder-space-2);
    border: none;
    border-inline-start: 1px solid var(--cinder-border);
    background: var(--cinder-surface-raised);
    color: var(--cinder-text-subtle);
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background 120ms ease,
      color 120ms ease;
  }
  @media (hover: hover) {
    .dx-import__copy:hover {
      background: var(--cinder-surface-hover);
      color: var(--cinder-text);
    }
  }
  .dx-import__copy[data-copied] {
    color: var(--cinder-success);
  }
  .dx-import__copy:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }
  @media (forced-colors: active) {
    .dx-import__copy:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: 3px;
      box-shadow: none;
    }
  }

  /* ===== Layout + TOC ===== */
  /*
   * Split view: documentation reads on the left, the live preview stays put on
   * the right. The preview is the reason this page exists, so it holds its own
   * column and its own scroll position rather than being one section you scroll
   * past — the old inline stage was a fixed 360px box buried mid-page.
   */
  /*
   * Documentation view: ONE column, full width. The preview no longer takes a
   * fixed 38rem out of every page — that rail is what crushed the accessibility
   * notes into a half-width sub-column, shredded the keyboard-shortcut table to
   * one word per line, and forced the props table into stacked six-line cards at
   * ordinary desktop widths.
   */
  .dx-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'toc'
      'docs';
    padding-block: clamp(1.25rem, 2vw, 1.75rem) clamp(3rem, 6vw, 5rem);
    align-items: start;
    min-width: 0;
  }

  /* View switcher. */
  .dx-views {
    display: flex;
    gap: var(--cinder-space-1);
    padding-block-start: clamp(1rem, 2vw, 1.5rem);
    border-block-end: 1px solid var(--cinder-border-muted);
  }

  /* The Documentation panel opens with its own full-width section index, which
   * carries a rule of its own. Stacked directly under this one that read as two
   * separate nav bars sitting on top of each other. When the documentation layout
   * follows, drop this rule so the tab row and the section index form ONE header
   * group with a single divider beneath the pair. The Playground panel has no
   * section index, so there the rule stays and the tabs keep their own edge. */
  .dx-views:has(+ .dx-layout) {
    border-block-end-color: transparent;
  }
  .dx-views__tab {
    padding: var(--cinder-space-2) var(--cinder-space-3);
    border: none;
    border-block-end: 2px solid transparent;
    background: transparent;
    color: var(--cinder-text-subtle);
    font-size: var(--cinder-text-sm);
    cursor: pointer;
  }
  .dx-views__tab[aria-selected='true'] {
    color: var(--cinder-text);
    font-weight: var(--cinder-font-medium);
    border-block-end-color: var(--cinder-accent);
  }
  @media (hover: hover) {
    .dx-views__tab:hover {
      color: var(--cinder-text);
    }
  }
  .dx-views__tab:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
    border-radius: var(--cinder-radius-sm);
  }
  @media (forced-colors: active) {
    .dx-views__tab:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      box-shadow: none;
    }
  }

  /*
   * Playground view: a real stage, with the props panel beside it rather than
   * stacked under a 38rem column. The stage takes the space; the panel takes
   * what a form needs and no more.
   */
  .dx-playground {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 22rem);
    gap: clamp(1.5rem, 3vw, 2.5rem);
    padding-block: clamp(1.25rem, 2vw, 1.75rem) clamp(3rem, 6vw, 5rem);
    align-items: start;
  }
  .dx-playground__stage {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
    min-width: 0;
  }
  .dx-playground__panel {
    position: sticky;
    top: calc(var(--dx-topbar-h) + 1.5rem);
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
    max-height: calc(100vh - var(--dx-topbar-h) - 3rem);
    overflow: auto;
    overscroll-behavior: contain;
    min-width: 0;
  }
  @media (max-width: 1000px) {
    .dx-playground {
      grid-template-columns: minmax(0, 1fr);
    }
    .dx-playground__panel {
      position: static;
      max-height: none;
      overflow: visible;
    }
  }
  .dx-toc {
    grid-area: toc;
  }
  .dx-content {
    grid-area: docs;
    min-width: 0;
  }

  .dx-landing-cta {
    display: inline-block;
    padding: var(--cinder-space-2) var(--cinder-space-4);
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-accent);
    color: var(--cinder-accent-contrast);
    font-size: var(--cinder-text-sm);
    font-weight: var(--cinder-font-medium);
    text-decoration: none;
  }

  .dx-landing-cta:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  @media (forced-colors: active) {
    .dx-landing-cta:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      box-shadow: none;
    }
  }

  /* Landing has no preview column, so the prose gets the full width. */
  .dx-content--landing {
    grid-column: 1 / -1;
    padding-block: clamp(1.25rem, 2vw, 1.75rem) clamp(3rem, 6vw, 5rem);
    max-width: 78rem;
    margin-inline: auto;
  }
  /* Stage controls: a compact instrument strip above the stage. */
  .dx-viewport {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-1);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-surface-raised);
  }
  .dx-viewport__sizes {
    display: flex;
    gap: 2px;
  }
  .dx-viewport__size,
  .dx-viewport__expand {
    padding: var(--cinder-space-1) var(--cinder-space-2);
    border: 1px solid transparent;
    border-radius: var(--cinder-radius-sm);
    background: transparent;
    color: var(--cinder-text-muted);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    letter-spacing: 0.06em;
    cursor: pointer;
    text-transform: uppercase;
  }
  @media (hover: hover) {
    .dx-viewport__size:hover,
    .dx-viewport__expand:hover {
      background: var(--cinder-surface-hover);
      color: var(--cinder-text);
    }
  }
  .dx-viewport__size[aria-pressed='true'] {
    border-color: var(--cinder-border);
    background: var(--cinder-bg);
    color: var(--cinder-text);
  }
  .dx-viewport__expand {
    margin-inline-start: auto;
  }
  .dx-viewport__readout {
    color: var(--cinder-text-subtle);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    font-variant-numeric: tabular-nums;
  }
  .dx-viewport__size:focus-visible,
  .dx-viewport__expand:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }
  @media (forced-colors: active) {
    .dx-viewport__size:focus-visible,
    .dx-viewport__expand:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      box-shadow: none;
    }
  }

  /* The stage honours the simulated width, centred, so narrow settings read as
     a device rather than a left-aligned sliver. */
  /*
   * A width wider than the stage column still has to be reachable, or picking it
   * does nothing visible — the stage takes the requested width and the column
   * scrolls horizontally to it.
   */
  .dx-playground__stage .dx-stage {
    width: var(--dx-stage-w, 100%);
    max-width: none;
    margin-inline: auto;
  }
  .dx-playground__stage {
    overflow-x: auto;
  }
  .dx-playground__stage .dx-stage__canvas {
    min-height: 18rem;
  }
  /* Examples and demos may intentionally have a minimum usable width (a
     permission matrix or sortable row cannot collapse into 200px). Keep that
     width reachable inside its own stage instead of letting it widen the page. */
  .dx-stage__canvas {
    max-width: 100%;
    min-width: 0;
    overflow-x: auto;
  }
  .dx.is-focus-mode .dx-playground__stage .dx-stage {
    flex: 1;
  }

  /* Synthesized structural values — shown read-only so the reader can see what
     the preview actually renders with, and that it matches the snippet. */
  .dx-play__seeds {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-3);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-surface-raised);
  }
  .dx-seed {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-1);
    min-width: 0;
  }
  .dx-seed__name {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text);
  }
  .dx-seed__value {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-muted);
    overflow-wrap: anywhere;
  }

  /* Compose-guidance copy, shown on a compound part's stage in place of a
     preview it structurally cannot have. */
  .dx-stage__compose {
    margin: 0;
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-sm);
    line-height: 1.5;
  }

  /* The honest replacement for the old blanket "no adjustable props" line. It
     sits INSIDE the playground block alongside whatever the section could still
     show, rather than standing in for the section. */
  .dx-play__note {
    margin: 0;
    color: var(--cinder-text-muted);
    font-size: var(--cinder-text-sm);
    line-height: 1.5;
  }
  .dx-play__note code {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text);
  }

  /*
   * Focus mode expands the stage over the whole viewport. Pure CSS on one
   * document — the old implementation needed an iframe and postMessage.
   */
  .dx.is-focus-mode .dx-playground__stage {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    height: 100vh;
    padding: var(--cinder-space-5);
    background: var(--cinder-bg);
  }
  .dx.is-focus-mode .dx-playground__panel,
  .dx.is-focus-mode .dx-views,
  .dx.is-focus-mode .dx-toc,
  .dx.is-focus-mode .dx-content,
  .dx.is-focus-mode .dx-hero {
    display: none;
  }

  /* The nav sits outside `.dx`, so the rule above cannot reach it. Left visible
     it stayed focusable underneath the full-viewport preview — keyboard users
     would tab into links they cannot see. */
  .dx-shell:has(.dx.is-focus-mode) .dx-nav {
    display: none;
  }
  .dx-toc {
    position: sticky;
    top: var(--dx-topbar-h);
    z-index: 30;
    align-self: start;
    margin-block-end: var(--cinder-space-5);
    padding-block: var(--cinder-space-2) 0;
    border-block-end: 1px solid var(--cinder-border-muted);
    /* Match the surface this sits ON, not the page behind it. The section index
     * lives inside the white documentation card, so filling it with `--cinder-bg`
     * painted a grey band across the card — which, stacked directly under the
     * Documentation/Playground tab row and its rule, read as a second nav bar.
     * Sticky positioning still needs an opaque-enough fill to occlude content
     * scrolling beneath, so this stays a near-solid surface rather than going
     * fully transparent. */
    background: color-mix(in oklch, var(--cinder-surface-raised), transparent 8%);
    backdrop-filter: blur(8px);
    min-width: 0;
  }
  .dx-toc__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: row;
    gap: var(--cinder-space-1);
    overflow-x: auto;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
  }
  .dx-toc__list::-webkit-scrollbar {
    display: none;
  }
  /*
   * A tab strip, styled as one. It used to carry vertical-RAIL CSS — a 2px
   * `border-inline-start` that the active state recoloured — inside a horizontal
   * flex row, so selecting a section just tinted a divider to the left of it.
   * The correct treatment already existed, but only inside the ≤920px variant.
   */
  .dx-toc__link {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: var(--cinder-space-2-5, 0.625rem);
    padding: var(--cinder-space-2) var(--cinder-space-2-5, 0.625rem);
    border-block-end: 2px solid transparent;
    /* Without this, labels wrapped mid-phrase at every width above 920px — the
       only `nowrap` in the file was in the narrow variant. */
    white-space: nowrap;
    color: var(--cinder-text-subtle);
    text-decoration: none;
    font-size: var(--cinder-text-sm);
    line-height: 1.3;
    transition:
      color 120ms ease,
      border-color 120ms ease;
  }
  @media (hover: hover) {
    .dx-toc__link:hover {
      color: var(--cinder-text);
    }
  }
  .dx-toc__num {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    color: var(--cinder-text-disabled);
    width: 1.1rem;
    flex-shrink: 0;
  }
  .dx-toc__link[data-active] {
    color: var(--cinder-text);
    font-weight: var(--cinder-font-medium);
    border-block-end-color: var(--cinder-accent);
  }
  .dx-toc__link[data-active] .dx-toc__num {
    color: var(--cinder-accent-text);
  }
  .dx-toc__link:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }
  @media (forced-colors: active) {
    .dx-toc__link:focus-visible {
      outline: var(--cinder-ring-width) solid LinkText;
      outline-offset: 3px;
      box-shadow: none;
    }
  }

  /* ===== Sections ===== */
  .dx-content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    /* Section headers already carry their own separator — an eyebrow number, a
       title, and a hairline rule — so 72px between them was the third thing
       saying the same boundary. */
    gap: clamp(2.5rem, 4vw, 3.5rem);
  }
  .dx-section {
    scroll-margin-block-start: calc(var(--dx-topbar-h) + 1.5rem);
  }
  .dx-section__head {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-3);
    margin-block-end: var(--cinder-space-5);
  }
  .dx-section__num {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    letter-spacing: 0.1em;
    color: var(--cinder-accent-text);
    padding: 2px var(--cinder-space-2);
    border: 1px solid color-mix(in oklch, var(--cinder-accent), transparent 70%);
    border-radius: var(--cinder-radius-sm);
    background: color-mix(in oklch, var(--cinder-accent), transparent 92%);
  }
  .dx-section__title {
    font-size: var(--cinder-text-2xl);
    font-weight: var(--cinder-font-semibold);
    letter-spacing: -0.01em;
    color: var(--cinder-text);
    margin: 0;
  }
  .dx-section__rule {
    flex: 1;
    height: 1px;
    background: var(--cinder-border-muted);
  }

  .dx-prose {
    color: var(--cinder-text-muted);
    line-height: var(--cinder-leading-relaxed);
    text-wrap: pretty;
  }

  /* README prose */
  .readme-content :global(h1),
  .readme-content :global(h2),
  .readme-content :global(h3) {
    color: var(--cinder-text);
    font-weight: var(--cinder-font-semibold);
    line-height: var(--cinder-leading-tight);
    margin: var(--cinder-space-6) 0 var(--cinder-space-3);
  }
  .readme-content :global(h1:first-child),
  .readme-content :global(h2:first-child),
  .readme-content :global(h3:first-child) {
    margin-top: 0;
  }
  /* Component README titles are removed in the documentation transform; keep
     this defensive rule for fixture and malformed-content paths. The landing
     README title is instead omitted structurally in the server renderer, so it
     never contributes a duplicate H1 to exported or hydrated markup. */
  .readme-content :global(h1:first-child) {
    display: none;
  }
  /*
   * ONE prose scale, for both surfaces.
   *
   * These rules used to be split across four overlapping selector families —
   * `.dx-prose`, `.readme-content`, `.dx-content--landing`, and the
   * `.cinder-markdown-content` utility that is served on every page and applied
   * to neither of them. The landing page and the component README therefore
   * disagreed on `pre`, `table`, and inline `code` for no reason anyone had
   * chosen. The landing family now carries only its LAYOUT rules.
   */
  .readme-content :global(p),
  .readme-content :global(ul),
  .readme-content :global(ol),
  .readme-content :global(dl),
  .readme-content :global(table),
  .readme-content :global(blockquote),
  .readme-content :global(hr) {
    margin: 0 0 var(--cinder-space-4);
  }
  .readme-content :global(h4),
  .readme-content :global(h5),
  .readme-content :global(h6) {
    color: var(--cinder-text);
    font-weight: var(--cinder-font-semibold);
    line-height: var(--cinder-leading-tight);
    margin: var(--cinder-space-5) 0 var(--cinder-space-2);
  }
  /* Matches the CodeBlock component's light surface, and for the same reason: these
   * blocks carry Shiki-highlighted markup, and `github-light` is fitted to #ffffff
   * with almost no margin (its keyword red is 4.58:1 on white against a 4.5:1 AA
   * floor). A tinted field here fails WCAG exactly as it does in the component, so
   * the definition comes from the border rather than the fill. */
  .readme-content :global(pre) {
    padding: var(--cinder-space-4);
    overflow-x: auto;
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    background: var(--cinder-surface-raised);
  }
  /* A CodeBlock renders its own <pre> INSIDE its own bordered, rounded, clipped
   * container, so the prose rule above was painting a second bordered rounded box
   * within the first — the doubled corners visible on every documentation code
   * sample. The component owns its frame; the prose rule applies only to bare
   * <pre> in README markdown. */
  .readme-content :global(.cinder-code-block pre) {
    border: 0;
    border-radius: 0;
    background: transparent;
  }
  .readme-content :global(pre code) {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
  }
  .readme-content :global(table) {
    width: 100%;
    border-collapse: collapse;
  }
  .readme-content :global(blockquote) {
    padding-inline-start: var(--cinder-space-4);
    border-inline-start: 2px solid var(--cinder-border);
    color: var(--cinder-text-muted);
  }
  /*
   * A block element needs MORE separation from the prose that follows it than
   * two paragraphs need from each other — otherwise a code block, table, or
   * callout reads as though the next sentence belongs to it. Everything above
   * shares one trailing margin; this adds the extra only where a block is
   * followed by prose.
   */
  .readme-content
    :global(
      :is(pre, table, blockquote, ul, ol, dl, .cinder-code-block, .cinder-callout)
        + :is(p, h1, h2, h3, h4, h5, h6)
    ) {
    margin-block-start: var(--cinder-space-6);
  }
  .readme-content :global(.cinder-code-block),
  .readme-pre-fallback {
    margin-block-end: var(--cinder-space-4);
  }
  .readme-pre-fallback {
    overflow-x: auto;
  }
  /* Same reason as the block above: an inline code span filled with white is
   * invisible against a white page. */
  .readme-content :global(code) {
    font-family: var(--cinder-font-mono);
    font-size: 0.95em;
    background: var(--cinder-surface-inset);
    padding-inline: 0.2em;
    border-radius: var(--cinder-radius-sm);
  }

  /* ===== Doc-page code-block overrides =====
     Keep the component-owned viewport visibly scrollable in documentation
     surfaces without creating nested scroll regions inside the highlighted
     or plain <pre> content. */
  .dx :global(.cinder-code-block__viewport) {
    scrollbar-width: auto;
  }

  /* ===== Preview stage ===== */
  .dx-stage {
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    background: var(--cinder-surface);
    overflow: hidden;
    box-shadow: var(--cinder-shadow-sm);
    margin-block-start: var(--cinder-space-6);
  }
  .dx-stage__bar {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-2) var(--cinder-space-3) var(--cinder-space-2) var(--cinder-space-4);
    border-block-end: 1px solid var(--cinder-border-muted);
    background: var(--cinder-surface-raised);
  }
  .dx-stage__dot {
    width: 7px;
    height: 7px;
    border-radius: var(--cinder-radius-full);
    background: var(--cinder-border-strong);
  }
  .dx-stage__label {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--cinder-text-subtle);
  }
  .dx-stage__canvas {
    padding: clamp(1rem, 2.5vw, 1.75rem);
  }
  .dx-stage__note {
    margin: 0;
    padding: var(--cinder-space-1) var(--cinder-space-3) var(--cinder-space-2);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
    border-block-start: 1px solid var(--cinder-border-subtle, var(--cinder-border));
  }
  /* Snapshot-mode body: just the mounted examples, no docs chrome, so the
     visual-regression / a11y harness captures a clean component mount. The light
     surface is pure white (carried over from the docs page) so translucent
     component backgrounds — e.g. a selected tree row's 15%-accent fill —
     composite over the same white the visual baselines were captured against,
     rather than the body's grey `--cinder-bg`, which would shift the contrast. */
  .snapshot-examples {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-6);
    background: light-dark(oklch(100% 0 0), var(--cinder-bg));
  }

  .snapshot-empty-heading {
    margin: 0;
    font-family: var(--cinder-font-sans);
    font-size: var(--cinder-text-xl);
    font-weight: var(--cinder-font-weight-semibold);
    /* Explicit token (not `inherit`) so contrast is computed against the white
       snapshot surface, keeping axe's color-contrast check green. */
    color: var(--cinder-text);
  }

  .example-preview {
    display: block;
    min-height: 2rem;
  }
  /* Frame chat examples so they read as a bounded chat surface — the way a
     consumer would drop the Chat into a card in a real app. Docs-only: the
     component itself stays unbordered so consumers control their own framing.
     Scoped to the live `.dx-stage__canvas` (NOT `.snapshot-examples`) so the
     visual-regression / axe snapshots keep capturing the bare component.
     `.chat-container` only appears on the Chat page. */
  .dx-stage__canvas .example-preview :global(.chat-container) {
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    overflow: hidden;
  }
  .example-preview :global(.example-preview-row) {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: var(--cinder-space-4);
  }
  .example-preview :global(.example-preview-column) {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--cinder-space-4);
  }

  /* ===== Use / Avoid ===== */
  .dx-guide {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--cinder-space-4);
  }
  .dx-guide__card {
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    background: var(--cinder-surface-raised);
    padding: var(--cinder-space-5);
    box-shadow: var(--cinder-shadow-sm);
  }
  .dx-guide__head {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2-5, 0.625rem);
    margin-block-end: var(--cinder-space-4);
    font-weight: var(--cinder-font-semibold);
    color: var(--cinder-text);
  }
  .dx-guide__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.6rem;
    height: 1.6rem;
    border-radius: var(--cinder-radius-md);
  }
  .dx-guide__icon--use {
    color: var(--cinder-color-success-fg);
    background: var(--cinder-color-success-bg);
  }
  .dx-guide__icon--avoid {
    color: var(--cinder-color-danger-fg);
    background: var(--cinder-color-danger-bg);
  }
  .dx-guide__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
  }
  .dx-guide__list li {
    display: grid;
    grid-template-columns: 1.1rem 1fr;
    gap: var(--cinder-space-2-5, 0.625rem);
    font-size: var(--cinder-text-sm);
    line-height: var(--cinder-leading-snug);
    color: var(--cinder-text-muted);
  }
  .dx-guide__list--use :global(svg) {
    color: var(--cinder-success);
    margin-top: 1px;
  }
  .dx-guide__list--avoid :global(svg) {
    color: var(--cinder-danger);
    margin-top: 1px;
  }
  .dx-guide__alt {
    display: inline-block;
    margin-block-start: 2px;
    color: var(--cinder-accent-text);
    font-weight: var(--cinder-font-medium);
    text-decoration: none;
  }
  .dx-guide__alt:hover {
    text-decoration: underline;
  }
  .dx-guide__alt:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
    border-radius: var(--cinder-radius-sm);
  }
  @media (forced-colors: active) {
    .dx-guide__alt:focus-visible {
      outline: var(--cinder-ring-width) solid LinkText;
      outline-offset: 3px;
      box-shadow: none;
    }
  }

  /* ===== Playground ===== */
  .dx-play__intro {
    margin-block-end: var(--cinder-space-5);
  }
  .dx-play__skipped {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }
  .dx-play__controls {
    container-type: inline-size;
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    background: var(--cinder-surface-raised);
    box-shadow: var(--cinder-shadow-sm);
    /* Deliberately NOT sticky and NOT its own scroll container. `.dx-playground__panel`
       is both now, and nesting a second sticky scroller inside a sticky scroller
       makes neither behave: the inner box pins against a parent that is itself
       moving, and a many-prop component ends up with two scrollbars competing for
       the same gesture. */
  }
  .dx-play__controls-head {
    padding: var(--cinder-space-3) var(--cinder-space-4);
    border-block-end: 1px solid var(--cinder-border-muted);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--cinder-text-subtle);
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
  }
  /* The controls panel is a fixed 16.5rem column, so a side-by-side label/control
     row squeezes long monospace prop names to one character per line. Stack instead:
     label + description on their own row, the control full-width below. The boolean
     toggle is tiny, so it stays inline at the end of the label row (see __row). */
  .dx-ctl {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-3-5, 0.875rem) var(--cinder-space-4);
  }
  .dx-ctl + .dx-ctl {
    border-block-start: 1px solid var(--cinder-border-muted);
  }
  .dx-ctl__text {
    min-width: 0;
  }
  .dx-ctl__name {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text);
    /* Break only when a token genuinely overflows the column, never per-character. */
    overflow-wrap: break-word;
  }
  .dx-ctl__desc {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
    margin-block-start: 2px;
    line-height: 1.4;
  }
  /* A boolean control keeps its label and toggle on one row (the toggle is small);
     the label text can shrink and the toggle pins to the inline end. */
  .dx-ctl--inline {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-3);
  }
  .dx-ctl--inline .dx-ctl__text {
    flex: 1;
  }
  .dx-ctl__select,
  .dx-ctl__input {
    color-scheme: inherit;
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-surface-inset);
    color: var(--cinder-text);
    font-family: inherit;
    font-size: var(--cinder-text-sm);
    padding: var(--cinder-space-1-5) var(--cinder-space-2);
    /* Fill the panel width rather than crowding against the right edge. */
    inline-size: 100%;
  }

  /* ===== Examples ===== */
  .dx-examples {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: var(--cinder-space-6);
  }
  .dx-example {
    scroll-margin-block-start: calc(var(--dx-topbar-h) + 1.5rem);
  }
  .dx-example__head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--cinder-space-4);
    margin-block-end: var(--cinder-space-3);
  }
  .dx-example__title {
    font-size: var(--cinder-text-lg);
    font-weight: var(--cinder-font-semibold);
    color: var(--cinder-text);
    margin: 0;
  }
  .dx-example__desc {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-subtle);
    margin: 2px 0 0;
    max-width: 60ch;
  }
  .dx-example__body {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
  }
  .source-loading {
    margin: 0;
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-subtle);
    font-style: italic;
  }
  .example-error__message {
    margin: 0;
    font-weight: var(--cinder-font-medium);
  }
  .example-error__stack {
    margin: var(--cinder-space-3) 0 0;
    padding: var(--cinder-space-3);
    border-radius: var(--cinder-radius-sm);
    background: var(--cinder-surface-inset);
    color: var(--cinder-text-subtle);
    font-size: var(--cinder-text-xs);
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-x: auto;
    max-height: 16rem;
  }
  .example-error__detail {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: var(--cinder-space-1) var(--cinder-space-4);
    margin: 0;
    font-size: var(--cinder-text-sm);
  }
  .example-error__detail dt {
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-text-subtle);
  }
  .example-error__detail dd {
    margin: 0;
    word-break: break-word;
  }
  .example-error__actions {
    display: flex;
    gap: var(--cinder-space-2);
    margin-block-start: var(--cinder-space-4);
  }

  /* ===== Props table ===== */
  .props-section {
    container: props-section / inline-size;
  }
  .props-table-scroll {
    overflow-x: auto;
    overscroll-behavior-x: contain;
    border-radius: var(--cinder-radius-sm);
  }
  .props-table-scroll:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: inset 0 0 0 var(--cinder-ring-width) var(--cinder-ring-color);
  }
  .props-section :global(.cinder-table__caption) {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  .props-name,
  .props-type,
  .props-default {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
  }
  .props-default {
    white-space: nowrap;
  }
  .props-name {
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-accent-text);
  }
  .props-type {
    display: inline-flex;
    flex-direction: column;
    gap: var(--cinder-space-0-5, 0.125rem);
    align-items: flex-start;
    max-inline-size: 40rem;
    min-inline-size: 0;
    overflow-wrap: break-word;
  }
  .props-type__member {
    white-space: pre-wrap;
    max-width: 28rem;
    min-inline-size: 0;
    overflow-wrap: anywhere;
  }
  .props-type--union .props-type__member {
    display: flex;
    align-items: baseline;
    gap: 0.35ch;
  }
  .props-type__sep {
    color: var(--cinder-text-subtle);
    user-select: none;
  }
  .props-name-cell {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--cinder-space-1-5, 0.375rem);
  }
  .dx-prop-flag {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: var(--cinder-space-0-5, 0.125rem) var(--cinder-space-1-5, 0.375rem);
    border-radius: var(--cinder-radius-sm);
    margin-inline-start: var(--cinder-space-1);
  }
  .dx-prop-flag--req {
    color: var(--cinder-color-danger-fg);
    background: var(--cinder-color-danger-bg);
    border: 1px solid var(--cinder-color-danger-border);
  }
  .dx-prop-flag--bind {
    color: var(--cinder-accent-text);
    background: color-mix(in oklch, var(--cinder-accent), transparent 90%);
    border: 1px solid color-mix(in oklch, var(--cinder-accent), transparent 72%);
    margin-inline-start: 0;
  }
  /* The cap's escape hatch. Nothing is discarded — a reader checking whether a
     given member exists can still open it. */
  .props-type__more {
    margin-block-start: var(--cinder-space-1);
  }
  .props-type__more > summary {
    display: inline-block;
    cursor: pointer;
    list-style: none;
    color: var(--cinder-accent-text);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .props-type__more > summary::-webkit-details-marker {
    display: none;
  }
  .props-type__more > summary:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
    border-radius: var(--cinder-radius-sm);
  }
  @media (forced-colors: active) {
    .props-type__more > summary:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: 2px;
      box-shadow: none;
    }
  }
  /* All-short members (country codes, HTML tag names) wrap as one line rather
     than a 245-row column. */
  .props-type--union-compact {
    flex-direction: row;
    flex-wrap: wrap;
    column-gap: 0.35ch;
  }
  .props-description {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
  }
  .props-dash {
    color: var(--cinder-text-subtle);
  }

  .props-table-scroll {
    position: relative;
  }
  /* The fade affordance renders ONLY when the table actually overflows
     horizontally — gated by the `is-scrollable` class that `scrollOverflowSentinel`
     toggles via ResizeObserver. Without this gate a non-overflowing table would
     show a misleading fade over its right edge (the always-on version reviewers
     flagged). */
  .props-table-scroll.is-scrollable::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 3rem;
    pointer-events: none;
    background: linear-gradient(
      to right,
      transparent,
      var(--cinder-surface-raised, var(--cinder-surface)) 80%
    );
  }

  /* Narrow container → stacked cards (same ::before-label pattern as before). */
  @container props-section (max-width: 34rem) {
    .props-table-scroll {
      /* Some generated TypeScript signatures remain wider than a phone-sized
       * card. Keep that overflow on the table's own scroll surface instead of
       * allowing it to widen the whole documentation page. */
      overflow-x: auto;
    }
    .props-table-scroll.is-scrollable::after {
      display: none;
    }
    .props-section :global(.cinder-table) {
      display: block;
      inline-size: 100%;
    }
    .props-section :global(.cinder-table thead) {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
    }
    .props-section :global(.cinder-table tbody),
    .props-section :global(.cinder-table tr) {
      display: block;
    }
    .props-section :global(.cinder-table tr) {
      padding-block: var(--cinder-space-3);
      border-block-end: 1px solid var(--cinder-border);
    }
    .props-section :global(.cinder-table td) {
      display: grid;
      grid-template-columns: minmax(4.5rem, max-content) minmax(0, 1fr);
      gap: var(--cinder-space-3);
      padding-block: var(--cinder-space-1);
      border: none;
      text-align: start;
    }
    .props-section :global(.cinder-table td > *) {
      min-inline-size: 0;
    }
    /* Labels come from each cell's own `data-label`, which the template emits
       from `PROP_COLUMNS`. The previous `nth-child` rules encoded column
       POSITION, so removing a column silently shifted every label after it by
       one — and only below a 34rem container width, where nothing would notice. */
    .props-section :global(.cinder-table td[data-label])::before {
      content: attr(data-label);
      font-weight: var(--cinder-font-medium);
      color: var(--cinder-text-subtle);
    }
  }

  /* ===== Accessibility ===== */
  .dx-a11y-alert {
    margin-block-end: var(--cinder-space-5);
  }
  /*
   * One column. The two-column split existed only because the prose column was
   * ~38rem short — it is what crushed the accessibility notes into a half-width
   * sub-column beside the shortcut table. With the documentation view at full
   * width there is nothing to work around.
   */
  .dx-a11y {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--cinder-space-5);
    align-items: start;
  }
  .dx-keys {
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    overflow: hidden;
    background: var(--cinder-surface-raised);
    box-shadow: var(--cinder-shadow-sm);
  }
  .dx-keys__row {
    display: grid;
    grid-template-columns: 9rem 1fr;
    gap: var(--cinder-space-3);
    align-items: start;
    padding: var(--cinder-space-3) var(--cinder-space-4);
    font-size: var(--cinder-text-sm);
  }
  .dx-keys__key-list {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--cinder-space-1);
    min-inline-size: 0;
  }
  .dx-keys__separator {
    color: var(--cinder-text-muted);
  }
  .dx-keys__alternative {
    display: inline-flex;
    gap: var(--cinder-space-1);
    align-items: center;
  }
  .dx-keys__row + .dx-keys__row {
    border-block-start: 1px solid var(--cinder-border-muted);
  }
  .dx-keys__action {
    color: var(--cinder-text-muted);
    line-height: 1.4;
  }
  .dx-notes {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
  }
  .dx-note {
    display: grid;
    grid-template-columns: 1.1rem 1fr;
    gap: var(--cinder-space-2-5, 0.625rem);
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
    line-height: var(--cinder-leading-snug);
  }
  .dx-note :global(svg) {
    color: var(--cinder-accent-text);
    margin-top: 1px;
  }

  /* ===== Related ===== */
  .dx-related {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
    gap: var(--cinder-space-3);
  }
  .dx-rel {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-2);
    padding: var(--cinder-space-4);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    background: var(--cinder-surface-raised);
    text-decoration: none;
    color: inherit;
    box-shadow: var(--cinder-shadow-sm);
    transition:
      border-color 120ms ease,
      transform 120ms ease,
      box-shadow 120ms ease;
  }
  @media (hover: hover) {
    .dx-rel:hover {
      border-color: var(--cinder-border-strong);
      transform: translateY(-2px);
      box-shadow: var(--cinder-shadow-md);
    }
  }
  .dx-rel:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }
  @media (forced-colors: active) {
    .dx-rel:focus-visible {
      outline: var(--cinder-ring-width) solid LinkText;
      outline-offset: 3px;
      box-shadow: none;
    }
  }
  .dx-rel__top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cinder-space-2);
  }
  .dx-rel__name {
    font-weight: var(--cinder-font-semibold);
    color: var(--cinder-text);
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
  }
  .dx-rel :global(.dx-rel__arrow) {
    color: var(--cinder-text-disabled);
    transition:
      color 120ms ease,
      transform 120ms ease;
  }
  @media (hover: hover) {
    .dx-rel:hover :global(.dx-rel__arrow) {
      color: var(--cinder-accent-text);
      transform: translate(2px, -2px);
    }
  }

  /* ===== Raw artifacts ===== */
  .dx-raw__grid {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-6);
    margin-block-start: var(--cinder-space-4);
  }
  .dx-raw__panel h3 {
    font-size: var(--cinder-text-base);
    font-weight: var(--cinder-font-semibold);
    color: var(--cinder-text);
    margin: 0 0 var(--cinder-space-2);
  }
  /* ===== Responsive ===== */
  @media (max-width: 1080px) {
    .dx-hero__grid {
      grid-template-columns: minmax(0, 1fr);
      align-items: start;
    }
    .dx-spec {
      max-width: 26rem;
    }
  }

  @media (max-width: 920px) {
    .dx-layout {
      grid-template-columns: minmax(0, 1fr);
    }
    /* Everything else this block used to set now lives in the base rules — it
       was a duplicate that happened to be correct while the base was not. Only
       the full-bleed edge treatment is genuinely narrow-viewport-specific. */
    .dx-toc {
      margin-inline: calc(var(--dx-gutter) * -1);
      padding-inline: var(--dx-gutter);
    }
  }
  @media (max-width: 640px) {
    .dx-guide {
      grid-template-columns: minmax(0, 1fr);
    }
    .dx-spec {
      max-width: none;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dx * {
      transition-duration: 0.01ms !important;
      animation-duration: 0.01ms !important;
    }
    /* The hover lift is a position change, not a transition, so zeroing
       durations doesn't stop the instantaneous jump — suppress it outright. */
    .dx-rel:hover,
    .dx-rel:hover :global(.dx-rel__arrow) {
      transform: none;
    }
  }
  /* Forced-colors (Windows High Contrast): box-shadow focus rings are
     suppressed by the browser, so the inset/offset rings on every interactive
     element vanish. Restore a system-color outline so focus stays visible. */
  @media (forced-colors: active) {
    /* The props table is excluded here and handled below: it is an
       `overflow-x: auto` scroll region, so its outline must be drawn inside. */
    .dx :is(button, a, [tabindex]):not(.props-table-scroll):focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: 2px;
    }
    /* An outward outline (the generic +2px above) is clipped by the scroll
       box and effectively invisible, so draw the forced-colors outline INSIDE
       the container with a negative offset — mirroring the inset `box-shadow`
       the non-forced-colors `:focus-visible` rule already uses. */
    .props-table-scroll:focus-visible {
      outline: var(--cinder-ring-width) solid ButtonText;
      outline-offset: calc(var(--cinder-ring-width) * -1);
    }
  }
</style>
