<!-- dev-only playground scaffold; window.__CINDER_EXAMPLES__ is injected server-side -->
<script lang="ts">
  import { mount, unmount } from 'svelte';
  import { Accordion } from '@lostgradient/cinder/accordion';
  import { AccordionItem } from '@lostgradient/cinder/accordion-item';
  import { Alert } from '@lostgradient/cinder/alert';
  import { Badge } from '@lostgradient/cinder/badge';
  import { Button } from '@lostgradient/cinder/button';
  import { Callout } from '@lostgradient/cinder/callout';
  import { CodeBlock } from '@lostgradient/cinder/code-block';
  import { Collapsible } from '@lostgradient/cinder/collapsible';
  import { Kbd } from '@lostgradient/cinder/kbd';
  import { Skeleton } from '@lostgradient/cinder/skeleton';
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
  import { splitReadmeHtml } from './split-readme-html.ts';
  import {
    formatErrorForClipboard,
    toMountErrorDetail,
    type MountErrorDetail,
    type SourceErrorDetail,
  } from './example-error.ts';
  import { fetchComponentDocumentation } from './component-documentation-reference.ts';
  import type {
    ComponentDocumentationPayload,
    JsonValue,
  } from './component-documentation-types.ts';
  import { splitUnionType, toPropReferenceRows } from './manifest-reference.ts';
  import { computeActiveSection, type SectionOffset } from './component-page-scroll-spy.ts';
  import {
    buildPlaygroundModel,
    buildSnippet,
    type PlaygroundValue,
  } from './component-page-playground.ts';

  type CinderExampleDescriptor = {
    scenario: string;
    title: string;
    description?: string;
    featured?: boolean;
  };
  type CinderWindow = Window &
    typeof globalThis & { __CINDER_EXAMPLES__?: CinderExampleDescriptor[] };
  type BadgeVariant = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent';
  type StatusDotStatus = 'online' | 'warning' | 'error' | 'pending' | 'neutral' | 'accent';

  // Height of the sticky top bar, in pixels — used for scroll-spy activation
  // and smooth-scroll offset so anchored sections clear the bar.
  const TOP_BAR_HEIGHT = 52;

  function readExamples(): CinderExampleDescriptor[] {
    if (typeof window === 'undefined') return [];
    const raw = (window as CinderWindow).__CINDER_EXAMPLES__;
    return Array.isArray(raw) ? raw : [];
  }

  const examples: CinderExampleDescriptor[] = readExamples();
  const explicitlyFeatured = examples.filter((example) => example.featured === true);

  // Snapshot mode (`?snapshot=1`) is how the visual-regression and a11y test
  // harness loads this route. Those tests assert global single-instance counts
  // (e.g. exactly one `.cinder-section-heading`), so we must not mount the
  // featured example twice. The Overview live preview is therefore suppressed in
  // snapshot mode — the Examples section still mounts each scenario exactly once.
  const snapshotMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('snapshot') === '1';

  // The Overview live preview uses the first featured example, or the first
  // example overall. Undefined when there are no examples at all, and suppressed
  // in snapshot mode so it never double-mounts a scenario the Examples section
  // already shows.
  const overviewExample: CinderExampleDescriptor | undefined = snapshotMode
    ? undefined
    : (explicitlyFeatured[0] ?? examples[0]);

  // Extract the component name from the current URL path: /page/<name>
  const componentName: string =
    window.location.pathname.replace(/^\/page\//, '').split('/')[0] ?? '';

  // --- Theme toggle -----------------------------------------------------
  // Cinder tokens switch on `color-scheme` (via `light-dark()`); the playground
  // bridge mirrors the same value onto `data-cinder-theme` for bookkeeping. We
  // read the active scheme on mount and, on toggle, write BOTH `color-scheme`
  // (the real switch) and `data-cinder-theme` so we stay consistent with the
  // bridge, plus persist to localStorage under the pre-paint key.
  function readInitialTheme(): 'light' | 'dark' {
    const scheme = document.documentElement.style.colorScheme;
    if (scheme === 'dark' || scheme === 'light') return scheme;
    return document.documentElement.dataset['cinderTheme'] === 'dark' ? 'dark' : 'light';
  }
  let theme: 'light' | 'dark' = $state(readInitialTheme());

  function toggleTheme(): void {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.style.colorScheme = theme;
    document.documentElement.dataset['cinderTheme'] = theme;
    try {
      localStorage.setItem('cinder-docs-theme', theme);
    } catch {
      // Private mode / disabled storage — the in-memory theme still applies.
    }
  }

  // --- Source-fetch + per-scenario accordion (preserved from the tabbed page) -
  const fetchedSource: Record<string, string | null> = $state({});
  const loadingSource: Record<string, boolean> = $state({});
  const mountErrors: Record<string, MountErrorDetail | undefined> = $state({});
  const sourceErrors: Record<string, SourceErrorDetail | undefined> = $state({});
  const exampleDisclosures = $state(
    examples.map(({ scenario }) => ({ scenario, expandedIds: [] as string[] })),
  );

  function disclosureFor(
    scenario: string,
  ): { scenario: string; expandedIds: string[] } | undefined {
    return exampleDisclosures.find((entry) => entry.scenario === scenario);
  }

  async function fetchSource(scenario: string): Promise<void> {
    const url = `/example-src/${componentName}/${scenario}`;
    loadingSource[scenario] = true;
    sourceErrors[scenario] = undefined;
    try {
      const response = await fetch(url);
      if (response.ok) {
        fetchedSource[scenario] = await response.text();
      } else {
        fetchedSource[scenario] = null;
        sourceErrors[scenario] = {
          url,
          detail: `${response.status} ${response.statusText}`.trim(),
        };
      }
    } catch (error) {
      fetchedSource[scenario] = null;
      sourceErrors[scenario] = {
        url,
        detail: error instanceof Error ? error.message : String(error),
      };
    } finally {
      loadingSource[scenario] = false;
    }
  }

  async function copyError(detail: MountErrorDetail): Promise<void> {
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined) return;
    try {
      await navigator.clipboard.writeText(formatErrorForClipboard(detail));
    } catch {
      // Clipboard write can reject (permissions, insecure context).
    }
  }

  // Lazily fetch each example's source the first time its disclosure opens.
  $effect(() => {
    for (const entry of exampleDisclosures) {
      if (
        entry.expandedIds.includes('source') &&
        fetchedSource[entry.scenario] === undefined &&
        !loadingSource[entry.scenario]
      ) {
        void fetchSource(entry.scenario);
      }
    }
  });

  // Mount each registered scenario into its preview container via an attachment.
  // An attachment runs exactly when its element is created and tears down when
  // the element is removed, so there is no effect-vs-DOM timing race (the old
  // effect-based approach mounted before the `{#if documentation}` subtree was
  // patched in). The featured scenario can appear twice — once in Overview, once
  // in Examples — and each container gets its own attachment + its own mount, so
  // the two instances stay independent with correct per-node cleanup.
  function mountScenario(scenario: string): (element: HTMLElement) => () => void {
    return (element: HTMLElement) => {
      const registry =
        ((window as unknown as Record<string, unknown>)['__CINDER_SCENARIOS__'] as
          | Record<string, unknown>
          | undefined) ?? {};
      const Component = registry[scenario];
      if (typeof Component !== 'function') {
        console.error(`[cinder playground] no registered component for scenario "${scenario}"`);
        return () => {};
      }
      let app: ReturnType<typeof mount> | undefined;
      try {
        app = mount(Component as Parameters<typeof mount>[0], { target: element });
        mountErrors[scenario] = undefined;
      } catch (error) {
        console.error(`[cinder playground] failed to mount example "${scenario}":`, error);
        mountErrors[scenario] = toMountErrorDetail(error);
      }
      return () => {
        if (app === undefined) return;
        try {
          unmount(app);
        } catch {
          // Best-effort cleanup only.
        }
      };
    };
  }

  // --- Documentation payload (fetched once) -----------------------------
  let documentation = $state<ComponentDocumentationPayload | null>(null);
  let documentationLoading = $state(true);
  let documentationError: string | null = $state(null);

  const skeletonRowCount = 5;
  const propRows = $derived(
    documentation === null ? [] : toPropReferenceRows(documentation.propsManifest),
  );

  function propsTypeClass(typeMembers: readonly string[]): string {
    return typeMembers.length > 1 ? 'props-type props-type--union' : 'props-type';
  }

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

  $effect(() => {
    if (componentName === '') {
      documentationLoading = false;
      return;
    }
    let cancelled = false;
    fetchComponentDocumentation(componentName)
      .then((payload) => {
        if (!cancelled) documentation = payload;
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          documentationError =
            error instanceof Error ? error.message : 'Failed to load documentation.';
        }
      })
      .finally(() => {
        if (!cancelled) documentationLoading = false;
      });
    return () => {
      cancelled = true;
    };
  });

  // --- Import line copy --------------------------------------------------
  let importCopied = $state(false);
  const importStatement = $derived(
    documentation === null
      ? ''
      : `import { ${documentation.component.exportName} } from '${documentation.component.importSpecifier}';`,
  );

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
      ? { controls: [], skipped: [], hasUnsatisfiedRequired: false }
      : buildPlaygroundModel(documentation.propsManifest),
  );
  // Live control values, keyed by prop name. Seeded from each control's default
  // the first time the model resolves.
  const playgroundValues: Record<string, PlaygroundValue> = $state({});
  let playgroundSeeded = false;
  $effect(() => {
    if (playgroundSeeded || playgroundModel.controls.length === 0) return;
    for (const control of playgroundModel.controls) {
      playgroundValues[control.name] = control.value;
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
        ),
  );
  const showGeneratedPlayground = $derived(
    playgroundModel.controls.length > 0 && !playgroundModel.hasUnsatisfiedRequired,
  );

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
    if (showGeneratedPlayground) list.push({ id: 'playground', num: '', label: 'Playground' });
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

  // Turn a kebab-case component id into sentence-case display text, e.g.
  // `segmented-control` → `Segmented control`. The href keeps the raw id.
  // Callers pass an `avoidWhen.alternative`, which the manifest generator
  // validates as a non-empty kebab id, so the empty-string case can't arrive
  // from real data (it returns `''` harmlessly if it ever does).
  function humanizeId(id: string): string {
    const spaced = id.replace(/-/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }
</script>

{#if snapshotMode}
  <!-- Snapshot mode (`?snapshot=1`): the visual-regression / a11y test harness
       loads this route and screenshots / axe-scans the page, expecting a clean
       single mount of each example with no docs chrome (matching the prior
       examples-only snapshot). Rendering the full page here would add README
       Shiki code blocks (low-contrast tokens), the hero, scroll-spy, etc. to
       every component's snapshot — so we render only the example mounts. -->
  <div class="snapshot-examples" data-component-page>
    {#if examples.length === 0}
      <!-- Components without `*.example.svelte` files have nothing to mount. The
           test harness still waits for `#app > *` to be VISIBLE (non-zero box)
           before running axe, so an empty container would resolve to `hidden`
           and time out. Render a visible, axe-clean heading so the snapshot has
           deterministic, contrast-safe content. -->
      <h1 class="snapshot-empty-heading">{humanizeId(componentName)}</h1>
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
  <div class="dx" data-component-page>
    <!-- ===== Top bar ===== -->
    <header class="dx-topbar">
      <div class="dx-topbar__inner">
        <nav class="dx-crumbs" aria-label="Breadcrumb">
          <span class="dx-crumbs__mark">CINDER</span>
          <span class="dx-crumbs__sep" aria-hidden="true">/</span>
          {#if documentation !== null}
            <span>{documentation.component.categoryLabel}</span>
            <span class="dx-crumbs__sep" aria-hidden="true">/</span>
            <span class="dx-crumbs__current">{documentation.component.name}</span>
          {/if}
        </nav>
        <div class="dx-topbar__actions">
          <a
            class="dx-iconbtn"
            href="https://github.com/stevekinney/cinder"
            target="_blank"
            rel="noreferrer"
            aria-label="View source on GitHub"
          >
            <Github size={17} strokeWidth={1.5} aria-hidden="true" />
          </a>
          <button
            type="button"
            class="dx-iconbtn"
            onclick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            {#if theme === 'dark'}
              <Sun size={17} strokeWidth={1.5} aria-hidden="true" />
            {:else}
              <Moon size={17} strokeWidth={1.5} aria-hidden="true" />
            {/if}
          </button>
        </div>
      </div>
    </header>

    {#if documentationLoading}
      <div class="dx__inner dx-loading" aria-hidden="true">
        {#each Array.from({ length: skeletonRowCount }, (_, index) => index) as row (row)}
          <Skeleton height="2rem" radius="var(--cinder-radius-sm)" />
        {/each}
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
                  <span class="dx-import__code">{importStatement}</span>
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
                      <Badge variant="accent" size="sm">{tag}</Badge>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>

            <aside class="dx-spec" aria-label="Component facts">
              <div class="dx-spec__row">
                <span class="dx-spec__key">Status</span>
                <span class="dx-spec__val">
                  <StatusDot status={statusDotStatus(component.status)} label={component.status} />
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
                <span class="dx-spec__val dx-spec__val--mono">{component.exportName}</span>
              </div>
              <div class="dx-spec__row">
                <span class="dx-spec__key">Version</span>
                <span class="dx-spec__val dx-spec__val--mono">v{component.packageVersion}</span>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <!-- ===== Layout: TOC + content ===== -->
      <div class="dx__inner">
        <div class="dx-layout">
          <nav class="dx-toc" aria-label="On this page">
            <div class="dx-toc__label">On this page</div>
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
                  <div class="dx-stage__canvas">
                    {#if mountErrors[overviewExample.scenario] !== undefined}
                      {@const error = mountErrors[overviewExample.scenario]}
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
                                <a class="dx-guide__alt" href="/c/{item.alternative}" target="_top">
                                  Use {humanizeId(item.alternative)} instead
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

            <!-- -- Playground -- -->
            {#if showGeneratedPlayground}
              <section id="playground" class="dx-section">
                <div class="dx-section__head">
                  <span class="dx-section__num">{sectionNumber.get('playground') ?? ''}</span>
                  <h2 class="dx-section__title">Playground</h2>
                  <span class="dx-section__rule" aria-hidden="true"></span>
                </div>
                <p class="dx-prose dx-play__intro">
                  Adjust the props below — the snippet updates live. Copy it when it looks right.
                </p>
                <div class="dx-play">
                  <div class="dx-play__preview">
                    <CodeBlock code={playgroundSnippet} language="svelte" copyable />
                    {#if playgroundModel.skipped.length > 0}
                      <p class="dx-play__skipped">
                        Not adjustable here: {playgroundModel.skipped.join(', ')}.
                      </p>
                    {/if}
                  </div>
                  <div class="dx-play__controls">
                    <div class="dx-play__controls-head">
                      <Sliders size={13} strokeWidth={1.5} aria-hidden="true" />
                      Props
                    </div>
                    {#each playgroundModel.controls as control (control.name)}
                      <div class="dx-ctl">
                        <div class="dx-ctl__text">
                          <div class="dx-ctl__name">{control.name}</div>
                          {#if control.description !== undefined}
                            <div class="dx-ctl__desc">{control.description}</div>
                          {/if}
                        </div>
                        {#if control.kind === 'boolean'}
                          <Toggle
                            id="pg-{control.name}"
                            label={control.name}
                            hideLabel
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
                    {@const disclosure = disclosureFor(scenario)}
                    {@const source = fetchedSource[scenario]}
                    {@const mountError = mountErrors[scenario]}
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
                            <div class="dx-stage__canvas">
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
                                  onclick={() => copyError(mountError)}
                                >
                                  Copy error
                                </Button>
                              </div>
                            </Callout>
                          {/if}

                          <Accordion bind:expandedIds={disclosure.expandedIds}>
                            <AccordionItem id="source" title="Show code">
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
                                      onclick={() => fetchSource(scenario)}
                                    >
                                      Retry
                                    </Button>
                                  </div>
                                </Callout>
                              {:else if source !== undefined}
                                <CodeBlock code={source} language="svelte" copyable />
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
                  class="props-table-scroll"
                  role="region"
                  aria-label="Props for {componentName}"
                  tabindex="0"
                >
                  <Table caption={`Props for ${componentName}`} density="condensed">
                    <Table.Header>
                      <Table.Row>
                        <Table.HeaderCell scope="col">Name</Table.HeaderCell>
                        <Table.HeaderCell scope="col">Type</Table.HeaderCell>
                        <Table.HeaderCell scope="col">Default</Table.HeaderCell>
                        <Table.HeaderCell scope="col" align="center">Required</Table.HeaderCell>
                        <Table.HeaderCell scope="col" align="center">Bindable</Table.HeaderCell>
                        <Table.HeaderCell scope="col">Description</Table.HeaderCell>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      {#each propRows as prop (prop.name)}
                        <Table.Row>
                          <Table.Cell>
                            <code class="props-name">{prop.name}</code>
                            {#if prop.required}
                              <span class="dx-prop-flag dx-prop-flag--req">req</span>
                            {/if}
                          </Table.Cell>
                          <Table.Cell>
                            {@const typeMembers = splitUnionType(prop.type)}
                            <code class={propsTypeClass(typeMembers)}>
                              {#each typeMembers as member, index (index)}
                                <span class="props-type__member">
                                  {#if index > 0}<span class="props-type__sep" aria-hidden="true"
                                      >|
                                    </span>{/if}<span class="props-type__value">{member}</span>
                                </span>
                              {/each}
                            </code>
                          </Table.Cell>
                          <Table.Cell>
                            {#if prop.defaultValue !== undefined}
                              <code class="props-default">{prop.defaultValue}</code>
                            {:else}
                              <span class="props-dash" aria-hidden="true">—</span>
                            {/if}
                          </Table.Cell>
                          <Table.Cell align="center">
                            {#if prop.required}
                              <span class="dx-prop-flag dx-prop-flag--req">req</span>
                            {:else}
                              <span class="props-dash" aria-hidden="true">—</span>
                            {/if}
                          </Table.Cell>
                          <Table.Cell align="center">
                            {#if prop.bindable}
                              <span class="dx-prop-flag dx-prop-flag--bind">bind</span>
                            {:else}
                              <span class="props-dash" aria-hidden="true">—</span>
                            {/if}
                          </Table.Cell>
                          <Table.Cell>
                            {#if prop.description !== undefined}
                              <span class="props-description">{prop.description}</span>
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
                  <span class="dx-section__num">{sectionNumber.get('accessibility') ?? ''}</span>
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
                          <div><Kbd label={shortcut.keys} /></div>
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
                    <a class="dx-rel" href="/c/{related}" target="_top">
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
                        code={jsonBlock(documentation.rawArtifacts.manifestEntry)}
                        language="json"
                        copyable
                      />
                    </div>
                    <div class="dx-raw__panel">
                      <h3>Schema</h3>
                      <CodeBlock
                        code={jsonBlock(documentation.rawArtifacts.schema)}
                        language="json"
                        copyable
                      />
                    </div>
                    <div class="dx-raw__panel">
                      <h3>Variables</h3>
                      <CodeBlock
                        code={jsonBlock(documentation.rawArtifacts.variables)}
                        language="json"
                        copyable
                      />
                    </div>
                    <div class="dx-raw__panel">
                      <h3>Constraints</h3>
                      <CodeBlock
                        code={jsonBlock(documentation.rawArtifacts.constraints)}
                        language="json"
                        copyable
                      />
                    </div>
                    <div class="dx-raw__panel">
                      <h3>Examples</h3>
                      <CodeBlock
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
      </div>
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
    --dx-max: 78rem;
    --dx-rail: 14.5rem;
    --dx-topbar-h: 3.25rem;
    min-height: 100vh;
    background: light-dark(oklch(100% 0 0), var(--cinder-bg));
  }

  .dx__inner {
    max-width: var(--dx-max);
    margin-inline: auto;
    padding-inline: var(--dx-gutter);
  }

  /* ===== Top bar ===== */
  .dx-topbar {
    position: sticky;
    top: 0;
    z-index: 40;
    height: var(--dx-topbar-h);
    display: flex;
    align-items: center;
    border-block-end: 1px solid var(--cinder-border-muted);
    background: color-mix(in oklch, var(--cinder-bg), transparent 12%);
    backdrop-filter: saturate(1.4) blur(10px);
  }
  .dx-topbar__inner {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-4);
    width: 100%;
    max-width: var(--dx-max);
    margin-inline: auto;
    padding-inline: var(--dx-gutter);
  }
  .dx-crumbs {
    display: flex;
    align-items: center;
    gap: var(--cinder-space-2);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
    min-width: 0;
  }
  .dx-crumbs__mark {
    font-family: var(--cinder-font-mono);
    font-weight: var(--cinder-font-semibold);
    letter-spacing: 0.18em;
    color: var(--cinder-text);
    text-transform: uppercase;
    font-size: var(--cinder-text-2xs);
  }
  .dx-crumbs__sep {
    color: var(--cinder-border-strong);
  }
  .dx-crumbs__current {
    color: var(--cinder-text);
    font-weight: var(--cinder-font-medium);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .dx-topbar__actions {
    margin-inline-start: auto;
    display: flex;
    align-items: center;
    gap: var(--cinder-space-1-5, 0.375rem);
  }
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

  .dx-loading {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
    padding-block: var(--cinder-space-8);
  }
  .dx-error-region {
    padding-block: var(--cinder-space-8);
  }

  /* ===== Hero ===== */
  .dx-hero {
    padding-block: clamp(2rem, 5vw, 3.75rem) clamp(1.75rem, 4vw, 2.75rem);
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
  .dx-spec__val--mono {
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
  .dx-import__copy {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.1rem;
    border: none;
    border-inline-start: 1px solid var(--cinder-border);
    background: var(--cinder-surface);
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

  /* ===== Layout + TOC ===== */
  .dx-layout {
    display: grid;
    grid-template-columns: var(--dx-rail) minmax(0, 1fr);
    gap: clamp(1.5rem, 4vw, 4rem);
    padding-block: clamp(2rem, 4vw, 3.25rem) 5rem;
    align-items: start;
  }
  .dx-toc {
    position: sticky;
    top: calc(var(--dx-topbar-h) + 1.5rem);
    align-self: start;
  }
  .dx-toc__label {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--cinder-text-subtle);
    padding-inline-start: var(--cinder-space-4);
    margin-block-end: var(--cinder-space-3);
  }
  .dx-toc__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
  }
  .dx-toc__link {
    position: relative;
    display: flex;
    align-items: baseline;
    gap: var(--cinder-space-2-5, 0.625rem);
    padding: var(--cinder-space-1-5, 0.375rem) var(--cinder-space-4);
    border-inline-start: 2px solid var(--cinder-border-muted);
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
    border-inline-start-color: var(--cinder-accent);
  }
  .dx-toc__link[data-active] .dx-toc__num {
    color: var(--cinder-accent-text);
  }
  .dx-toc__link:focus-visible {
    outline: var(--cinder-ring-width) solid transparent;
    box-shadow: var(--_cinder-focus-ring-shadow);
  }

  /* ===== Sections ===== */
  .dx-content {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: clamp(3rem, 6vw, 4.5rem);
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
  .readme-content :global(h1:first-child) {
    display: none;
  }
  .readme-content :global(p),
  .readme-content :global(ul),
  .readme-content :global(ol),
  .readme-content :global(table) {
    margin: 0 0 var(--cinder-space-4);
  }
  .readme-content :global(.cinder-code-block),
  .readme-pre-fallback {
    margin-block-end: var(--cinder-space-4);
  }
  .readme-pre-fallback {
    overflow-x: auto;
  }
  .readme-content :global(code) {
    font-family: var(--cinder-font-mono);
    font-size: 0.95em;
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
    padding: clamp(1.5rem, 4vw, 3rem);
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
    /* Headroom above the first example mount. The old tabbed snapshot layout
       wrapped each example in a Card under an `<h2>Examples</h2>` inside a tab
       panel, pushing the first example ~100px down from the viewport top. The
       positioning test harness (selection-popover-positioning.playwright.ts)
       depends on that clearance: when a selection sits flush against the
       viewport top, SelectionPopover has no room to flip above and falls back
       to a `bottom` placement that OVERLAPS the selection — a real flip/shift
       bug in the shared anchored-overlay logic, tracked in issue #369 (the
       popover should anchor below the selection's bottom edge, not overlap it).
       This
       padding restores the fixture geometry the test was written against; it
       does not fix the underlying component bug. Sized (8rem) so the EXPANDED
       composer (~114px tall) also clears the selection when it flips above. */
    padding-block-start: var(--cinder-space-32);
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

  /* ===== Playground ===== */
  .dx-play__intro {
    margin-block-end: var(--cinder-space-5);
  }
  .dx-play {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 16.5rem;
    gap: var(--cinder-space-4);
    align-items: start;
  }
  .dx-play__preview {
    display: flex;
    flex-direction: column;
    gap: var(--cinder-space-3);
    min-width: 0;
  }
  .dx-play__skipped {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }
  .dx-play__controls {
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    background: var(--cinder-surface-raised);
    box-shadow: var(--cinder-shadow-sm);
    /* Scroll the controls when a many-prop component makes the sticky panel
       taller than the viewport, so lower controls stay reachable. The radius
       clips the inner rows. */
    overflow-y: auto;
    max-height: calc(100dvh - var(--dx-topbar-h) - 3rem);
    position: sticky;
    top: calc(var(--dx-topbar-h) + 1.5rem);
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
  .dx-ctl {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--cinder-space-3);
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
  }
  .dx-ctl__desc {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
    margin-block-start: 2px;
    line-height: 1.4;
  }
  .dx-ctl__select,
  .dx-ctl__input {
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    background: var(--cinder-surface-inset);
    color: var(--cinder-text);
    font-family: inherit;
    font-size: var(--cinder-text-sm);
    padding: var(--cinder-space-1) var(--cinder-space-2);
    max-width: 8rem;
  }

  /* ===== Examples ===== */
  .dx-examples {
    display: flex;
    flex-direction: column;
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
  .props-name {
    font-weight: var(--cinder-font-medium);
    color: var(--cinder-accent-text);
  }
  .props-type {
    display: inline-flex;
    flex-direction: column;
    gap: var(--cinder-space-0-5, 0.125rem);
    align-items: flex-start;
  }
  .props-type__member {
    white-space: nowrap;
  }
  .props-type--union .props-type__member {
    padding-inline-start: 1ch;
  }
  .props-type__sep {
    margin-inline-start: -1ch;
    color: var(--cinder-text-subtle);
  }
  .dx-prop-flag {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-2xs);
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
  .props-description {
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
  }
  .props-dash {
    color: var(--cinder-text-subtle);
  }

  /* Narrow container → stacked cards (same ::before-label pattern as before). */
  @container props-section (max-width: 34rem) {
    .props-table-scroll {
      overflow-x: visible;
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
      grid-template-columns: minmax(4.5rem, max-content) 1fr;
      gap: var(--cinder-space-3);
      padding-block: var(--cinder-space-1);
      border: none;
      text-align: start;
    }
    .props-section :global(.cinder-table td)::before {
      font-weight: var(--cinder-font-medium);
      color: var(--cinder-text-subtle);
    }
    .props-section :global(.cinder-table td:nth-child(1))::before {
      content: 'Name';
    }
    .props-section :global(.cinder-table td:nth-child(2))::before {
      content: 'Type';
    }
    .props-section :global(.cinder-table td:nth-child(3))::before {
      content: 'Default';
    }
    .props-section :global(.cinder-table td:nth-child(4))::before {
      content: 'Required';
    }
    .props-section :global(.cinder-table td:nth-child(5))::before {
      content: 'Bindable';
    }
    .props-section :global(.cinder-table td:nth-child(6))::before {
      content: 'Description';
    }
  }

  /* ===== Accessibility ===== */
  .dx-a11y-alert {
    margin-block-end: var(--cinder-space-5);
  }
  .dx-a11y {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr);
    gap: var(--cinder-space-4);
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
    align-items: center;
    padding: var(--cinder-space-3) var(--cinder-space-4);
    font-size: var(--cinder-text-sm);
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
    .dx-toc {
      position: sticky;
      top: var(--dx-topbar-h);
      z-index: 30;
      margin-inline: calc(var(--dx-gutter) * -1);
      padding-inline: var(--dx-gutter);
      padding-block: var(--cinder-space-2);
      background: color-mix(in oklch, var(--cinder-bg), transparent 8%);
      backdrop-filter: blur(8px);
      border-block-end: 1px solid var(--cinder-border-muted);
    }
    .dx-toc__label {
      display: none;
    }
    .dx-toc__list {
      flex-direction: row;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      gap: var(--cinder-space-1);
      scrollbar-width: none;
    }
    .dx-toc__list::-webkit-scrollbar {
      display: none;
    }
    .dx-toc__link {
      border-inline-start: none;
      border-block-end: 2px solid transparent;
      white-space: nowrap;
      padding: var(--cinder-space-2) var(--cinder-space-2-5, 0.625rem);
    }
    .dx-toc__link[data-active] {
      border-inline-start: none;
      border-block-end-color: var(--cinder-accent);
    }
    .dx-play {
      grid-template-columns: minmax(0, 1fr);
    }
    .dx-play__controls {
      position: static;
      order: -1;
      /* No longer sticky here, so drop the viewport height cap — the stacked
         panel should grow with its content. */
      max-height: none;
      overflow: visible;
    }
    .dx-a11y {
      grid-template-columns: minmax(0, 1fr);
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
    .dx-topbar {
      border-block-end: 1px solid ButtonText;
    }
  }
</style>
