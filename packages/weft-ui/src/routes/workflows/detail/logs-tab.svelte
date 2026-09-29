<script lang="ts">
  /**
   * Logs tab (plan T2.5, §9.2: "ctx.log in execution order with the replay
   * re-emit note").
   *
   * ## Why this is a permanent, honest empty state — by design, not a gap
   *
   * `ctx.log()` records (`WorkflowLogRecord`) are delivered ONLY to a
   * host-side `EngineOptions.onLog` sink registered at `Engine.create()`
   * time — an in-process hook. This was filed as weft#732 item 5, asking
   * either for a `getLogs(workflowId)` operation OR "confirmation that logs
   * are intentionally host-only and the console should stop trying."
   * `@lostgradient/weft@0.15.0` (PR #760, closing #732) answered with the
   * latter: its own summary states the boundary explicitly — "`ctx.log`
   * remains host-owned through `EngineOptions.onLog`" — and ships regression
   * tests locking that in rather than a retrieval operation. Re-verified
   * against 0.15.0's operation catalog: no `weft.workflows.logs.*`/`getLogs`
   * operation exists, `getEvents()`/`getTimeline()` still carry no log
   * entries, and `ctx.log` records remain outside `EVENTS_READ_EVENT_TYPES`.
   * A remote console like this one genuinely cannot read them, and per
   * weft's own decision, never will over this transport. This tab names
   * that plainly rather than building filter/search UI over data that can
   * never populate — not refiled, since the maintainers already chose
   * between the two outcomes the original issue offered.
   */
  import { EmptyState } from '@lostgradient/cinder';
</script>

<EmptyState
  title="Logs aren't available over the API"
  description={"ctx.log() records are only visible to a host-side EngineOptions.onLog sink — weft's maintainers confirmed this is intentional (weft#732), not a gap awaiting a fix, so this console can't read a workflow's ctx.log() history."}
/>
