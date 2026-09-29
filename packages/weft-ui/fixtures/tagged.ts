/**
 * Tags + search-attributes demo fixture (plan §11, Appendix B "Workflow list
 * (default/bulk-selection/empty×2/denied)" filter facets). Registers a
 * search-attribute schema and starts several runs with varied run-level tags
 * and search attributes so the console's filter UI has real facets to filter
 * on. See `fixtures/workflows.ts` for the append-only contract this file
 * participates in.
 */
import {
  activity,
  workflow,
  type SearchAttributeValue,
  type WorkflowHandle,
} from '@lostgradient/weft';

const ATTRIBUTE_PERSISTENCE_POLL_ATTEMPTS = 5;
const ATTRIBUTE_PERSISTENCE_POLL_DELAY_MS = 20;

interface OutreachCampaignInput {
  customerId: string;
  region: string;
  tier: string;
}

const sendOutreachMessage = activity({
  name: 'sendOutreachMessage',
  execute: async (input: { customerId: string }) => {
    return { customerId: input.customerId, sent: true };
  },
});

export const outreachCampaign = workflow({ name: 'customer-outreach-campaign' })
  .activities({ sendOutreachMessage })
  .searchAttributes({
    region: { type: 'string' },
    tier: { type: 'string' },
  })
  .execute(async function* (ctx, input: OutreachCampaignInput) {
    const sent = yield* ctx.run(sendOutreachMessage, { customerId: input.customerId });
    // Park here (rather than returning immediately) so the run stays
    // `running` instead of reaching a terminal status. weft deliberately
    // purges caller-supplied search attributes on every terminal transition
    // (`buildRetainedTerminalSearchAttributes` in
    // `weft/src/core/engine/attributes-tags.ts` keeps only its own
    // `weft:`-prefixed attributes, e.g. `failureCategory`) — a completed run
    // here would leave `region`/`tier` unqueryable via `attr.<name>=`
    // filters, defeating the point of this fixture. Tags are unaffected by
    // that cleanup (a separate index), so they'd survive completion either
    // way; staying parked demonstrates both facets together.
    yield* ctx.sleep('24h');
    return sent;
  });

/** Registerable workflow map — merged into `fixtures/workflows.ts`'s registry. */
export const taggedWorkflows = {
  'customer-outreach-campaign': outreachCampaign,
};

/** Narrow structural interface — see `fixtures/workflows.ts` for the pattern. */
export interface TaggedEngine {
  start(
    name: 'customer-outreach-campaign',
    input: OutreachCampaignInput,
    options?: {
      tags?: string[];
      searchAttributes?: Record<string, SearchAttributeValue>;
      defer?: boolean;
    },
  ): Promise<WorkflowHandle>;
  getAttributes(workflowId: string): Promise<Record<string, SearchAttributeValue> | null>;
}

interface OutreachRun {
  customerId: string;
  region: string;
  tier: string;
  tags: string[];
}

const OUTREACH_RUNS: readonly OutreachRun[] = [
  { customerId: 'cust_9001', region: 'us-east', tier: 'gold', tags: ['priority-customer', 'beta'] },
  { customerId: 'cust_9002', region: 'us-west', tier: 'silver', tags: ['beta'] },
  { customerId: 'cust_9003', region: 'eu-central', tier: 'gold', tags: ['priority-customer'] },
  { customerId: 'cust_9004', region: 'apac', tier: 'bronze', tags: [] },
];

/**
 * `engine.start(..., { defer: false })` only guarantees the generator has
 * been driven to its first yield (the `sendOutreachMessage` operation
 * *requested*), not that the engine has finished processing it — the
 * checkpoint commit that writes the queryable `KEYS.attribute()` record
 * (and its `idx:` entries) is a separate async storage write that may not
 * have landed by the time `start()` resolves (same caveat `reviews.ts`
 * documents for `ctx.review()`). This polls `getAttributes` for that commit
 * to land (condition-based, not a fixed sleep), capped at 5 attempts, so
 * `seedTagged` doesn't depend on the wall-clock slack that later seeders
 * happen to provide.
 */
async function waitForCommittedAttributes(engine: TaggedEngine, workflowId: string): Promise<void> {
  for (let attempt = 1; attempt <= ATTRIBUTE_PERSISTENCE_POLL_ATTEMPTS; attempt++) {
    const attributes = await engine.getAttributes(workflowId);
    if (attributes !== null) {
      return;
    }
    if (attempt < ATTRIBUTE_PERSISTENCE_POLL_ATTEMPTS) {
      await Bun.sleep(ATTRIBUTE_PERSISTENCE_POLL_DELAY_MS);
    }
  }
  throw new Error(
    `seedTagged: expected search attributes for workflow ${workflowId} to be committed ` +
      `within ${ATTRIBUTE_PERSISTENCE_POLL_ATTEMPTS} attempts — got none`,
  );
}

/**
 * Starts one run per `OUTREACH_RUNS` entry, each with distinct tags and
 * search attributes. Runs are deliberately left `running` (parked on the
 * workflow's trailing sleep, not awaited to completion) — see the
 * `outreachCampaign` body comment: a terminal run would have its
 * caller-supplied search attributes purged server-side, leaving the
 * `attr.<name>=` filter demo with nothing to match. Each run's start-time
 * tags and search attributes are polled durably committed (see
 * `waitForCommittedAttributes`) before starting the next, so the filter
 * demo data is settled before the dev server starts serving.
 */
export async function seedTagged(engine: TaggedEngine): Promise<void> {
  for (const run of OUTREACH_RUNS) {
    const handle = await engine.start(
      'customer-outreach-campaign',
      { customerId: run.customerId, region: run.region, tier: run.tier },
      {
        tags: run.tags,
        searchAttributes: { region: run.region, tier: run.tier },
        defer: false,
      },
    );
    await waitForCommittedAttributes(engine, handle.id);
  }
}
