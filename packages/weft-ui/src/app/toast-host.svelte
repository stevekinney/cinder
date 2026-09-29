<script module lang="ts">
  /**
   * Toast wiring (plan §10.4, §7, T1.5). Frozen after the Phase 1 Foundation
   * gate — see PROJECT-BRIEF "Shared contracts".
   *
   * Cinder's `useToast()` needs a `<ToastRegion>` ancestor and can only be
   * called from a component rendered inside one (`_internal/toast-context.ts`:
   * "Region-scoped state means each `<ToastRegion />` instance is
   * independent" — a deliberate non-singleton design). But `query.ts`'s
   * mutation-error default (plan §4: "mutation error → toast via fault
   * mapping") runs from plain `.ts` with no component tree at all, and this
   * app mounts exactly one `<ToastHost>` for its whole lifetime — a single,
   * permanent region, not the modal-scoped/SSR case Cinder's doc is warning
   * about. This module script is the bridge: the instance below registers
   * its `useToast()` result here once, on mount, and every module — component
   * or plain `.ts` — calls `showToast`/`showFault` instead of `useToast()`
   * directly. This is an app-local composition over `<ToastRegion>` (not a
   * fork or a restyle — PROJECT-BRIEF), needed only because this one caller
   * genuinely has no component context to call `useToast()` from.
   */
  import type { ToastApi, ToastOptions, ToastVariant } from '@lostgradient/cinder';

  import {
    FAULT_TREATMENT_TITLE,
    type FaultTreatment,
    type FaultTreatmentKind,
  } from '../lib/faults.ts';

  let toastApi: ToastApi | undefined;

  /** Registered by the mounted `<ToastHost>`'s own attachment below — not meant to be called from other modules. */
  function registerToastApi(next: ToastApi | undefined): void {
    toastApi = next;
  }

  /**
   * Show a toast from anywhere, including a plain `.ts` module with no
   * component context. Calling this before `<ToastHost>` has mounted is a
   * programming error reported through the platform error channel.
   */
  export function showToast(message: string, options?: ToastOptions): string | undefined {
    if (!toastApi) {
      const error = new Error('weft-ui: showToast() called before <ToastHost> mounted.');
      if (typeof globalThis.reportError === 'function') globalThis.reportError(error);
      else throw error;
      return undefined;
    }
    return toastApi.show(message, options);
  }

  /** Toast variant per treatment kind — `invalid`/`unauthorized`/`internal` are failures the operator must act on; `not-found`/`conflict`/`not-supported` are lower-stakes state mismatches. Exported so tests can assert the fault→toast policy directly rather than only through Cinder's rendered DOM. */
  export const FAULT_TOAST_VARIANT: Readonly<Record<FaultTreatmentKind, ToastVariant>> = {
    'not-found': 'warning',
    conflict: 'warning',
    invalid: 'danger',
    unauthorized: 'danger',
    'not-supported': 'warning',
    internal: 'danger',
  };

  /**
   * Duration per toast variant (T9.4 accessibility pass, design §C: "high
   * urgency `role=alert` (danger left edge, persists) vs normal
   * `role=status` (auto-dismiss 6s)"). Mirrors
   * `../app/engine-status.svelte.ts`'s `toastForNotification` exactly —
   * that module already gets this right for fleet-notification toasts;
   * `showFault` previously left `duration` unset for every kind, so a
   * danger-variant fault (the operator-must-act case) silently inherited
   * Cinder's uniform 5s default and auto-dismissed like a low-stakes one.
   * `0` means "persist until manually dismissed" (Cinder's own `duration`
   * contract — `toast-region.svelte`'s `armTimer` never schedules removal
   * when `duration <= 0`), never "invisible"/"instant".
   */
  export const FAULT_TOAST_DURATION_MS: Readonly<Record<FaultTreatmentKind, number>> = {
    'not-found': 6_000,
    conflict: 6_000,
    invalid: 0,
    unauthorized: 0,
    'not-supported': 6_000,
    internal: 0,
  };

  /**
   * Shows a `FaultTreatment` (plan §10.4) as a toast — the generic fallback
   * presentation for a fault with no dedicated inline surface, chiefly
   * `query.ts`'s default mutation `onError`. Surfaces reachable through
   * `<FaultBoundary>` show the same treatment inline instead; this and that
   * are two delivery mechanisms for the same classification, not competing
   * ones.
   */
  export function showFault(treatment: FaultTreatment): string | undefined {
    return showToast(`${FAULT_TREATMENT_TITLE[treatment.kind]}: ${treatment.message}`, {
      variant: FAULT_TOAST_VARIANT[treatment.kind],
      duration: FAULT_TOAST_DURATION_MS[treatment.kind],
    });
  }
</script>

<script lang="ts">
  import { ToastRegion, useToast } from '@lostgradient/cinder';
</script>

<ToastRegion position="bottom-right">
  {#snippet children()}
    {@const toast = useToast()}
    <span
      hidden
      {@attach () => {
        registerToastApi(toast);
        return () => registerToastApi(undefined);
      }}
    ></span>
  {/snippet}
</ToastRegion>
