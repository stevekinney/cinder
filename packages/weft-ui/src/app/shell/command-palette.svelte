<script lang="ts">
  /**
   * ⌘K search skeleton (plan §13 T1.6): ID-prefix search across workflows /
   * schedules / workers / reviews via each domain's list operation,
   * navigating to the matching record on select. "Skeleton" per the task
   * brief — this is a jump-to-record finder, not the full command surface
   * (actions, recent items) a later pass may add.
   *
   * Each domain search runs independently and swallows its own failure (a
   * 403 from a scope this principal lacks, a transient network error)
   * rather than failing the whole palette — a search-as-you-type surface
   * degrading one section to "no results" beats it going blank.
   */
  import { CommandItem, CommandPalette, EmptyState } from '@lostgradient/cinder';
  import type {
    ReviewListEntry,
    ScheduleSummary,
    WorkflowSummary,
    HttpClient,
  } from '@lostgradient/weft';

  import { router, workflowDetailPath } from '../../lib/router.svelte.ts';

  interface CommandPaletteLauncherProps {
    open: boolean;
    client: HttpClient;
  }

  let { open = $bindable(false), client }: CommandPaletteLauncherProps = $props();

  let query = $state('');

  let workflowResults = $state<WorkflowSummary[]>([]);
  let scheduleResults = $state<ScheduleSummary[]>([]);
  let workerResults = $state<{ id: string; queue: string }[]>([]);
  let reviewResults = $state<ReviewListEntry[]>([]);

  const WORKFLOW_ID_PREFIX_PATTERN = /^[A-Za-z0-9_-]+$/;

  function containsQuery(needle: string, id: string): boolean {
    return id.toLowerCase().includes(needle.toLowerCase());
  }

  /**
   * `client.list({ idPrefix })` is server-side filtering per its documented
   * `ListFilter.idPrefix` contract — but `HttpClient`'s own query-string
   * builder (`@lostgradient/weft`,
   * `buildWorkflowListSearchParams`) never serializes `idPrefix` into the
   * request at all, so the server always receives an unfiltered `limit`-only
   * query and the prefix is silently dropped. Confirmed by direct request:
   * `client.list({ idPrefix: 'order', limit: 5 })` sends `GET /v1/workflows?
   * limit=5` (no `id_prefix` param), while `GET /v1/workflows?id_prefix=order`
   * hit directly correctly returns zero matches. This is an upstream
   * `@lostgradient/weft` bug — flagged for filing (blocked in this
   * environment: `gh auth status` reports an invalid `GITHUB_TOKEN`, so the
   * issue could not be filed from here; report this to the user/orchestrator
   * to file against `stevekinney/weft`). Workaround, not a weft fork: still
   * pass `idPrefix` (free once the bug is fixed, and lets the server apply
   * `limit` meaningfully today), but also re-filter client-side so the
   * palette is correct regardless.
   */
  async function search(currentQuery: string): Promise<void> {
    if (currentQuery.length === 0) {
      workflowResults = [];
      scheduleResults = [];
      workerResults = [];
      reviewResults = [];
      return;
    }

    const idPrefix = WORKFLOW_ID_PREFIX_PATTERN.test(currentQuery) ? currentQuery : undefined;

    const [workflows, schedules, workers, reviews] = await Promise.all([
      idPrefix
        ? client.list({ idPrefix, limit: 50 }).then(
            (result) =>
              result.items.filter((workflow) => workflow.id.startsWith(idPrefix)).slice(0, 5),
            () => [] as WorkflowSummary[],
          )
        : Promise.resolve([] as WorkflowSummary[]),
      client.listSchedules({ limit: 100 }).then(
        (result) =>
          result.items.filter((schedule) => containsQuery(currentQuery, schedule.id)).slice(0, 5),
        () => [] as ScheduleSummary[],
      ),
      client.operations['weft.workers.list']({}).then(
        (result) =>
          result.items.filter((worker) => containsQuery(currentQuery, worker.id)).slice(0, 5),
        () => [] as { id: string; queue: string }[],
      ),
      client.listReviews({}).then(
        (result) =>
          result.filter((review) => containsQuery(currentQuery, review.reviewId)).slice(0, 5),
        () => [] as ReviewListEntry[],
      ),
    ]);

    // `currentQuery` may be stale by the time these settle — drop results
    // for a query the user has already changed.
    if (currentQuery !== query) return;
    workflowResults = workflows;
    scheduleResults = schedules;
    workerResults = workers;
    reviewResults = reviews;
  }

  $effect(() => {
    const currentQuery = query;
    const timer = setTimeout(() => void search(currentQuery), 150);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    function onKeydown(event: KeyboardEvent): void {
      const isCommandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isCommandK) return;
      event.preventDefault();
      open = true;
    }
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  });

  function goTo(path: string): void {
    router.navigate(path);
    open = false;
  }
</script>

<CommandPalette
  bind:open
  bind:query
  label="Command palette"
  placeholder="Search workflows, schedules, workers, reviews…"
>
  {#snippet items()}
    {#if workflowResults.length > 0}
      <li role="presentation" class="weft-command-group">
        <span class="weft-command-group__label">Workflows</span>
        <ul role="group" aria-label="Workflows">
          {#each workflowResults as workflow (workflow.id)}
            <CommandItem
              value={`workflow-${workflow.id}`}
              description={workflow.type}
              onSelect={() => goTo(workflowDetailPath(workflow.id))}
            >
              {workflow.id}
            </CommandItem>
          {/each}
        </ul>
      </li>
    {/if}
    {#if scheduleResults.length > 0}
      <li role="presentation" class="weft-command-group">
        <span class="weft-command-group__label">Schedules</span>
        <ul role="group" aria-label="Schedules">
          {#each scheduleResults as schedule (schedule.id)}
            <CommandItem
              value={`schedule-${schedule.id}`}
              description={schedule.workflowType}
              onSelect={() => goTo('/schedules')}
            >
              {schedule.id}
            </CommandItem>
          {/each}
        </ul>
      </li>
    {/if}
    {#if workerResults.length > 0}
      <li role="presentation" class="weft-command-group">
        <span class="weft-command-group__label">Workers</span>
        <ul role="group" aria-label="Workers">
          {#each workerResults as worker (worker.id)}
            <CommandItem
              value={`worker-${worker.id}`}
              description={worker.queue}
              onSelect={() => goTo('/workers')}
            >
              {worker.id}
            </CommandItem>
          {/each}
        </ul>
      </li>
    {/if}
    {#if reviewResults.length > 0}
      <li role="presentation" class="weft-command-group">
        <span class="weft-command-group__label">Reviews</span>
        <ul role="group" aria-label="Reviews">
          {#each reviewResults as review (review.reviewId)}
            <CommandItem
              value={`review-${review.reviewId}`}
              description={review.reviewType}
              onSelect={() => goTo('/reviews')}
            >
              {review.reviewId}
            </CommandItem>
          {/each}
        </ul>
      </li>
    {/if}
  {/snippet}
  {#snippet empty()}
    <EmptyState
      title={query.length === 0 ? 'Search the console' : 'No matches'}
      description={query.length === 0
        ? 'Type an id or name to jump to a workflow, schedule, worker, or review.'
        : `Nothing matched "${query}".`}
    />
  {/snippet}
</CommandPalette>
