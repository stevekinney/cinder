<!--
  Test-only fixture isolating the live-preview mount from `component-page.svelte`
  (#405). The real page mounts the BARE component with the synthesized
  `playgroundValues` so the preview re-renders as the prop controls change. That
  mount is gated behind `bareComponent !== undefined && !snapshotMode`, and falls
  back to the static featured-example mount otherwise.

  This fixture reproduces that branch and the `mountLivePreview` attachment
  verbatim — same re-mount-on-`playgroundValues`-change semantics, same
  `$state.snapshot` plain-object props, same error keying by container DOM id —
  driven by bindable `playgroundValues` so a test can flip a control and assert
  the live mount re-renders with the new values. Mounting the full
  `component-page.svelte` is impractical (it reads `window.location`, the
  server-injected globals, and deep cinder imports), so this fixture stands in
  exactly as `component-page-mount-fixture.svelte` does for the example mounts.
-->
<script lang="ts" module>
  /** Mount-error record keyed by container DOM id, exposed for assertions. */
  export type MountErrorRecord = Record<string, string | undefined>;
</script>

<script lang="ts">
  import { mount, unmount, untrack } from 'svelte';

  type PlaygroundValue = string | number | boolean | undefined;

  type Props = {
    /**
     * The resolved bare component constructor, or `undefined` to exercise the
     * featured-example fallback branch (mirrors `bareComponent` in the page).
     */
    bareComponent?: unknown;
    /** The featured example component used when `bareComponent` is undefined. */
    featuredExample?: unknown;
    /** Scenario id for the featured-example container, mirroring the page. */
    featuredScenario?: string;
    /** Whether the page is in snapshot mode (`?snapshot=1`) — gates BOTH mounts off. */
    snapshotMode?: boolean;
    /** Initial synthesized prop values seeded into the owned `$state`. */
    initialValues?: Record<string, PlaygroundValue>;
    /** Bindable mount-error record, keyed by container DOM id. */
    mountErrors?: MountErrorRecord;
  };

  let {
    bareComponent,
    featuredExample,
    featuredScenario = 'demo',
    snapshotMode = false,
    initialValues = {},
    mountErrors = $bindable({}),
  }: Props = $props();

  // Own the prop values as `$state`, exactly as `component-page.svelte` does, so
  // the test mutates a KEY (`playgroundValues[name] = next`) the way the real
  // controls do — not by reassigning the whole object. `$state.snapshot` deep-
  // reads the proxy, so a key mutation is what actually re-runs the attachment.
  // `untrack` makes the one-time seed read explicit: only the INITIAL
  // `initialValues` is captured, after which `playgroundValues` is the source of
  // truth (mirrors the page seeding `$state` from control defaults once).
  const playgroundValues: Record<string, PlaygroundValue> = $state(
    untrack(() => ({ ...initialValues })),
  );

  /** Mutate a single control value — mirrors the page's `playgroundValues[name] = next`. */
  export function setValue(name: string, value: PlaygroundValue): void {
    playgroundValues[name] = value;
  }

  // Verbatim copy of `mountLivePreview` from component-page.svelte: read
  // `playgroundValues` INSIDE the returned attachment so Svelte re-runs it
  // (teardown + remount) on every control change; pass a plain snapshot rather
  // than the reactive proxy; key the error record by container DOM id.
  function mountLivePreview(Component: unknown): (element: HTMLElement) => () => void {
    return (element: HTMLElement) => {
      const mountKey = element.id;
      if (typeof Component !== 'function') {
        mountErrors[mountKey] = undefined;
        return () => {};
      }
      let app: ReturnType<typeof mount> | undefined;
      try {
        app = mount(Component as Parameters<typeof mount>[0], {
          target: element,
          props: $state.snapshot(playgroundValues),
        });
        mountErrors[mountKey] = undefined;
      } catch (error) {
        mountErrors[mountKey] = error instanceof Error ? error.message : String(error);
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

  // Verbatim copy of `mountScenario`'s shape for the fallback branch — a
  // no-props mount keyed by container id.
  function mountFeatured(Component: unknown): (element: HTMLElement) => () => void {
    return (element: HTMLElement) => {
      const mountKey = element.id;
      if (typeof Component !== 'function') {
        mountErrors[mountKey] = undefined;
        return () => {};
      }
      let app: ReturnType<typeof mount> | undefined;
      try {
        app = mount(Component as Parameters<typeof mount>[0], { target: element });
        mountErrors[mountKey] = undefined;
      } catch (error) {
        mountErrors[mountKey] = error instanceof Error ? error.message : String(error);
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
</script>

<div class="dx-play__preview">
  {#if bareComponent !== undefined && !snapshotMode}
    <div class="dx-stage">
      <span class="dx-stage__label">Live preview</span>
      <div
        class="example-preview"
        id="playground-live-mount"
        {@attach mountLivePreview(bareComponent)}
      ></div>
    </div>
  {:else if featuredExample !== undefined && !snapshotMode}
    <div class="dx-stage">
      <span class="dx-stage__label">Featured example</span>
      <div
        class="example-preview"
        id="playground-mount-{featuredScenario}"
        {@attach mountFeatured(featuredExample)}
      ></div>
    </div>
  {/if}
</div>
