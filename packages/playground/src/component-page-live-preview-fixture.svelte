<!--
  Test-only HOST for the live-preview logic in `component-page.svelte` (#405).

  It does NOT re-implement the mount/error/resolve behavior — it imports the same
  `createLivePreviewMount` and `resolveBareComponent` the page uses, so the test
  exercises production code rather than a copy that could drift. The fixture only
  supplies what the real page gets from its environment that a unit test cannot:
  the owned `$state` prop values (so a test can flip a control), the snapshot-mode
  flag, and a stand-in featured-example component for the fallback branch.

  The gating template mirrors the page's Playground branch exactly, including the
  `liveMountFailed` fall-through to the featured example when the bare mount fails
  and a featured example exists. Mounting the full `component-page.svelte` is
  impractical (it reads `window.location`, server-injected globals, and fetches
  documentation over HTTP), so this host stands in just as
  `component-page-mount-fixture.svelte` does for the example mounts.
-->
<script lang="ts" module>
  import type { MountErrorRecord } from './component-page-live-preview.ts';

  export type { MountErrorRecord };
</script>

<script lang="ts">
  import { mount, unmount, untrack } from 'svelte';

  import {
    createLivePreviewMount,
    isMountableComponent,
    resolveBareComponent,
  } from './component-page-live-preview.ts';
  import { toMountErrorDetail } from './example-error.ts';

  type PlaygroundValue = string | number | boolean | undefined;

  type Props = {
    /**
     * The bare component's module namespace, resolved by `resolveBareComponent`
     * exactly as the page resolves its prop. Pass `{ default: undefined }` (or a
     * module lacking the export) to exercise the featured-example fallback.
     */
    bareComponentModule?: unknown;
    /** Export name `resolveBareComponent` looks up first (mirrors `exportName`). */
    exportName?: string;
    /** The featured example component used when the bare component can't mount. */
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
    bareComponentModule,
    exportName = 'Demo',
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

  // Resolve + mount via the SAME production helpers the page uses, so a passing
  // test means the real page logic works, not a fixture copy of it.
  const bareComponent = $derived(resolveBareComponent(bareComponentModule, exportName));
  const liveMountFailed = $derived(mountErrors['playground-live-mount'] !== undefined);
  const mountLivePreview = createLivePreviewMount({
    readValues: () => $state.snapshot(playgroundValues),
    mountErrors,
  });

  // The featured-example fallback is a plain no-props mount keyed by container id
  // (mirrors `mountScenario`'s shape). Kept inline because it is trivial and not
  // the behavior under test — the live-preview path is. It narrows with the SAME
  // `isMountableComponent` guard, records errors with the SAME `toMountErrorDetail`
  // helper, and tears down with the SAME `void unmount` as the production code, so
  // the fallback path here can't diverge from the real error-keying contract.
  function mountFeatured(Component: unknown): (element: HTMLElement) => () => void {
    return (element: HTMLElement) => {
      const mountKey = element.id;
      if (!isMountableComponent(Component)) {
        mountErrors[mountKey] = undefined;
        return () => {};
      }
      let app: ReturnType<typeof mount> | undefined;
      try {
        app = mount(Component, { target: element });
        mountErrors[mountKey] = undefined;
      } catch (error) {
        mountErrors[mountKey] = toMountErrorDetail(error);
      }
      return () => {
        if (app === undefined) return;
        try {
          // `unmount` returns a Promise; teardown is fire-and-forget here.
          void unmount(app);
        } catch {
          // Best-effort cleanup only.
        }
      };
    };
  }
</script>

<div class="dx-play__preview">
  {#if bareComponent !== undefined && !snapshotMode && (!liveMountFailed || featuredExample === undefined)}
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
