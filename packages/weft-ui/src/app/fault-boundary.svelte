<script lang="ts">
  /**
   * `<svelte:boundary>` wrapper rendering the fault treatment inline (plan
   * §10.4, T1.5). Frozen after the Phase 1 Foundation gate — see
   * PROJECT-BRIEF "Shared contracts".
   *
   * One `FaultDisplay`-style banner for all six treatments (design reference:
   * `design/Weft Patterns.dc.html` "Fault / error banner · six fault codes"),
   * matched here with Cinder `Badge` + `lucide-svelte` icons + Cinder tokens
   * rather than hand-rolled color values. `Internal` additionally shows a
   * collapsible stack trace when the caught error is NOT an `HttpClientError`
   * (i.e. a rendering bug the boundary caught directly, never a wire fault) —
   * matching the design reference's "Collapsible stack trace" panel next to
   * the 500 row. Every `HttpClientError` also has a JS `.stack` (all `Error`
   * subclasses do), but it would only ever be the browser-side call stack of
   * where the client threw — weft never puts the server's actual stack on
   * the wire (`shapeRestFault` masks `EngineFailure` precisely so internal
   * detail doesn't leak to REST clients), so showing it would look like real
   * diagnostic information while actually being noise.
   *
   * `onerror` is reporting-only; `reset()` is wired to nothing but the
   * banner's own Retry button, on explicit user action — calling `reset()`
   * from `onerror` would just re-run the same failing subtree synchronously.
   */
  import type { ComponentType, Snippet, SvelteComponent } from 'svelte';

  import { Badge, Button, Collapsible } from '@lostgradient/cinder';
  import type { IconProps } from 'lucide-svelte';
  import {
    CircleSlash,
    CircleX,
    GitPullRequestClosed,
    Lock,
    SearchX,
    ServerCrash,
  } from 'lucide-svelte';

  import { HttpClientError } from '@lostgradient/weft';

  import {
    classifyFault,
    FAULT_TREATMENT_TITLE,
    UNKNOWN_FAULT_TREATMENT,
    type FaultTreatment,
    type FaultTreatmentKind,
  } from '../lib/faults.ts';

  interface FaultBoundaryProps {
    /** The content that may fail. */
    children: Snippet;
    /**
     * Called once when the boundary catches an error, before the failed
     * banner renders — for logging/telemetry only. Never call `reset()` from
     * here; see the module doc.
     */
    onFault?: ((treatment: FaultTreatment, error: unknown) => void) | undefined;
  }

  let { children, onFault }: FaultBoundaryProps = $props();

  function reportFault(error: unknown): void {
    onFault?.(classifyFault(error) ?? UNKNOWN_FAULT_TREATMENT, error);
  }

  function stackTraceOf(error: unknown): string | undefined {
    if (error instanceof HttpClientError) return undefined;
    return error instanceof Error && typeof error.stack === 'string' ? error.stack : undefined;
  }

  function errorName(error: unknown): string {
    return error instanceof Error ? error.name : 'Error';
  }

  /**
   * Icon per treatment kind, matching the design reference's fault-banner
   * icons verbatim. Typed via `ComponentType<SvelteComponent<...>>` (Svelte
   * 5's legacy-interop type), not `Component<IconProps>` — `lucide-svelte`
   * still ships icons as `SvelteComponentTyped` classes, not Svelte 5's
   * native functional component shape.
   */
  const FAULT_ICON: Readonly<
    Record<FaultTreatmentKind, ComponentType<SvelteComponent<IconProps>>>
  > = {
    'not-found': SearchX,
    conflict: GitPullRequestClosed,
    invalid: CircleX,
    unauthorized: Lock,
    'not-supported': CircleSlash,
    internal: ServerCrash,
  };

  /** Visual tone per treatment kind — drives both the banner's background/border and the `Badge` variant. `not-found`/`not-supported` are neutral (a missing/unsupported resource, not a failure); the rest are warning/danger per the design reference. */
  const FAULT_TONE: Readonly<Record<FaultTreatmentKind, 'neutral' | 'warning' | 'danger'>> = {
    'not-found': 'neutral',
    conflict: 'warning',
    invalid: 'danger',
    unauthorized: 'danger',
    'not-supported': 'neutral',
    internal: 'danger',
  };
</script>

<svelte:boundary onerror={(error: unknown) => reportFault(error)}>
  {@render children()}

  {#snippet failed(error: unknown, reset: () => void)}
    {@const treatment = classifyFault(error) ?? UNKNOWN_FAULT_TREATMENT}
    {@const Icon = FAULT_ICON[treatment.kind]}
    {@const tone = FAULT_TONE[treatment.kind]}
    {@const stack = treatment.kind === 'internal' ? stackTraceOf(error) : undefined}
    <div class="weft-fault-boundary" data-tone={tone} role="alert">
      <div class="weft-fault-boundary__banner">
        <Icon aria-hidden="true" size={16} class="weft-fault-boundary__icon" />
        <Badge variant={tone}>{FAULT_TREATMENT_TITLE[treatment.kind]}</Badge>
        <p class="weft-fault-boundary__message">{treatment.message}</p>
        <Button size="sm" variant="secondary" label="Retry" onclick={reset} />
      </div>

      {#if treatment.kind === 'conflict' && treatment.isSpentIdempotencyKey}
        <p class="weft-fault-boundary__note">
          This idempotency key has already been used and its run was purged — start with a new key.
        </p>
      {/if}

      {#if treatment.kind === 'invalid' && treatment.fieldErrors.length > 0}
        <ul class="weft-fault-boundary__field-errors">
          {#each treatment.fieldErrors as fieldError (fieldError.path)}
            <li><code>{fieldError.path}</code> — {fieldError.message}</li>
          {/each}
        </ul>
      {/if}

      {#if treatment.kind === 'internal' && treatment.tryViaJsonRpc}
        <p class="weft-fault-boundary__note">
          The REST API hides internal error detail on this response — the same request over JSON-RPC
          returns the full fault.
        </p>
      {/if}

      {#if stack}
        <Collapsible trigger={errorName(error)}>
          <pre class="weft-fault-boundary__stack">{stack}</pre>
        </Collapsible>
      {/if}
    </div>
  {/snippet}
</svelte:boundary>

<!-- Styles: `.weft-fault-boundary*` rules live in src/styles/foundation.css
     (plain global) because src/routes/system/query-fault-banner.svelte
     renders the same treatment markup — a scoped <style> block here would
     never reach it. -->
