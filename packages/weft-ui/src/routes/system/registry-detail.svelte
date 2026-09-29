<script lang="ts">
  /**
   * Registry → workflow definition detail (plan §9.7 T7.2; design `Weft
   * Console.dc.html` "System" § REGISTRY DEFINITION DETAIL). Renders the
   * expandable input/output schema `Tree`, the revision identity
   * (revision/manifestVersion/contractHash), the full contract surface
   * (signals/updates/queries/activities/finalizer — sourced for real as of
   * WFT-115, see `registry-view.ts`'s module doc), and the installed-
   * revisions panel with its Activate/compatibility flow
   * (`workflow-revisions-panel.svelte`).
   */
  import { DescriptionList, Tree, Badge, Button, CopyButton } from '@lostgradient/cinder';
  import { ArrowLeft, FileQuestion } from 'lucide-svelte';

  import { truncateId } from '../../lib/format/index.ts';
  import type {
    RegistryContractMessageRow,
    RegistryWorkflowRow,
    SchemaTreeNode,
  } from './registry-view.ts';
  import WorkflowRevisionsPanel from './workflow-revisions-panel.svelte';

  interface Props {
    row: RegistryWorkflowRow;
    onBack: () => void;
  }

  let { row, onBack }: Props = $props();
</script>

{#snippet schemaBadge(
  label: string,
  variant: 'neutral' | 'warning',
  monospace = false,
  className = '',
)}
  <Badge class={className} {variant} {monospace}>{label}</Badge>
{/snippet}

{#snippet schemaNode(node: SchemaTreeNode)}
  <Tree.Item id={node.id} label={node.name} branch={node.children.length > 0}>
    {#snippet row(context)}
      <span class="weft-schema-node" data-expanded={context.expanded}>
        <span class="weft-schema-node__name">{node.name}</span>
        {@render schemaBadge(node.type, 'neutral', true)}
        {@render schemaBadge(
          node.required ? 'required' : 'optional',
          node.required ? 'warning' : 'neutral',
          false,
          'weft-schema-node__requirement',
        )}
        {#if node.description}
          <span class="weft-schema-node__description">{node.description}</span>
        {/if}
      </span>
    {/snippet}
    {#each node.children as child (child.id)}
      {@render schemaNode(child)}
    {/each}
  </Tree.Item>
{/snippet}

{#snippet schemaTree(
  schema: readonly SchemaTreeNode[],
  rootType: string | undefined,
  emptyLabel: string,
)}
  {#if schema.length > 0}
    <Tree aria-label="Schema fields">
      {#each schema as node (node.id)}
        {@render schemaNode(node)}
      {/each}
    </Tree>
  {:else if rootType !== undefined}
    <div class="weft-registry-detail__no-schema">
      <FileQuestion aria-hidden="true" size={17} />
      <span>Declared as <code>{rootType}</code> — no object fields to list.</span>
    </div>
  {:else}
    <div class="weft-registry-detail__no-schema">
      <FileQuestion aria-hidden="true" size={17} />
      <span>{emptyLabel}</span>
    </div>
  {/if}
{/snippet}

{#snippet contractMessageList(entries: readonly RegistryContractMessageRow[], emptyLabel: string)}
  {#if entries.length === 0}
    <p class="weft-registry-detail__gap-note">{emptyLabel}</p>
  {:else}
    <ul class="weft-registry-detail__message-list">
      {#each entries as entry (entry.name)}
        <li class="weft-registry-detail__message">
          <details class="weft-registry-detail__message-details">
            <summary class="weft-registry-detail__message-header">
              <span class="weft-registry-detail__message-name">{entry.name}</span>
              {@render schemaBadge(
                entry.hasInputSchema ? `${entry.inputFields.length} in` : 'no input',
                entry.hasInputSchema ? 'neutral' : 'warning',
                true,
              )}
              {@render schemaBadge(
                entry.hasOutputSchema ? `${entry.outputFields.length} out` : 'no output',
                entry.hasOutputSchema ? 'neutral' : 'warning',
                true,
              )}
            </summary>
            <div class="weft-registry-detail__message-body">
              <div>
                <h4 class="weft-registry-detail__message-schema-title">Input</h4>
                {@render schemaTree(
                  entry.inputSchemaTree,
                  entry.inputSchemaRootType,
                  'No input schema declared.',
                )}
              </div>
              <div>
                <h4 class="weft-registry-detail__message-schema-title">Output</h4>
                {@render schemaTree(
                  entry.outputSchemaTree,
                  entry.outputSchemaRootType,
                  'No output schema declared.',
                )}
              </div>
            </div>
          </details>
        </li>
      {/each}
    </ul>
  {/if}
{/snippet}

<div class="weft-registry-detail">
  <Button variant="secondary" size="sm" label="Workflow definitions" onclick={onBack}>
    {#snippet leadingIcon()}<ArrowLeft aria-hidden="true" size={14} />{/snippet}
  </Button>

  <div class="weft-registry-detail__header">
    <h2 class="weft-registry-detail__title">{row.type}</h2>
    {#each row.tags as tag (tag)}
      <Badge variant="neutral">{tag}</Badge>
    {/each}
  </div>
  {#if row.description}
    <p class="weft-registry-detail__description">{row.description}</p>
  {/if}

  <div class="weft-registry-detail__identity">
    <span class="weft-registry-detail__identity-item" title={row.revision}>
      rev {truncateId(row.revision)}
      <CopyButton value={row.revision} iconOnly label={`Copy revision ${row.revision}`} />
    </span>
    <span class="weft-registry-detail__identity-item" title={row.contractHash}>
      contract {truncateId(row.contractHash)}
      <CopyButton
        value={row.contractHash}
        iconOnly
        label={`Copy contract hash ${row.contractHash}`}
      />
    </span>
    <span class="weft-registry-detail__identity-item">workflow v{row.workflowVersion}</span>
    <span class="weft-registry-detail__identity-item">manifest v{row.manifestVersion}</span>
  </div>

  <div class="weft-registry-detail__grid">
    <section class="weft-registry-detail__panel">
      <h3 class="weft-registry-detail__panel-title">
        Input schema
        <span class="weft-registry-detail__panel-meta">{row.inputFields.length} fields</span>
      </h3>
      {@render schemaTree(
        row.inputSchemaTree,
        row.inputSchemaRootType,
        'No input schema declared — this definition accepts an untyped payload.',
      )}
    </section>

    <section class="weft-registry-detail__panel">
      <h3 class="weft-registry-detail__panel-title">
        Output schema
        <span class="weft-registry-detail__panel-meta">{row.outputFields.length} fields</span>
      </h3>
      {@render schemaTree(
        row.outputSchemaTree,
        row.outputSchemaRootType,
        'No output schema declared — this definition returns an untyped result.',
      )}
    </section>

    <section class="weft-registry-detail__panel">
      <h3 class="weft-registry-detail__panel-title">
        Signals
        <span class="weft-registry-detail__panel-meta">{row.signals.length}</span>
      </h3>
      {@render contractMessageList(row.signals, 'No signals declared.')}
    </section>

    <section class="weft-registry-detail__panel">
      <h3 class="weft-registry-detail__panel-title">
        Updates
        <span class="weft-registry-detail__panel-meta">{row.updates.length}</span>
      </h3>
      {@render contractMessageList(row.updates, 'No updates declared.')}
    </section>

    <section class="weft-registry-detail__panel">
      <h3 class="weft-registry-detail__panel-title">
        Queries
        <span class="weft-registry-detail__panel-meta">{row.queries.length}</span>
      </h3>
      {@render contractMessageList(row.queries, 'No queries declared.')}
    </section>

    <section class="weft-registry-detail__panel">
      <h3 class="weft-registry-detail__panel-title">
        Activities
        <span class="weft-registry-detail__panel-meta">{row.activities.length}</span>
      </h3>
      {@render contractMessageList(row.activities, 'No activities declared.')}
    </section>

    <section class="weft-registry-detail__panel">
      <h3 class="weft-registry-detail__panel-title">Finalizer</h3>
      {#if row.finalizer}
        {@render contractMessageList([row.finalizer], 'No finalizer declared.')}
      {:else}
        <p class="weft-registry-detail__gap-note">No finalizer declared.</p>
      {/if}
    </section>

    <section class="weft-registry-detail__panel">
      <h3 class="weft-registry-detail__panel-title">Details</h3>
      <DescriptionList
        items={[
          { term: 'Type', definition: row.type },
          { term: 'Tags', definition: row.tags.length > 0 ? row.tags.join(', ') : 'none' },
          {
            term: 'Output schema',
            definition: row.hasOutputSchema ? `${row.outputFields.length} fields` : 'none',
          },
        ]}
      />
    </section>
  </div>

  <WorkflowRevisionsPanel workflowName={row.type} />
</div>

<style>
  .weft-registry-detail {
    max-width: 1080px;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .weft-registry-detail__header {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
  }

  .weft-registry-detail__title {
    margin: 0;
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-lg);
    font-weight: 600;
  }

  .weft-registry-detail__description {
    margin: 0;
    font-size: var(--cinder-text-sm);
    color: var(--cinder-text-muted);
    max-width: 640px;
    text-wrap: pretty;
  }

  .weft-registry-detail__identity {
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-registry-detail__identity-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .weft-registry-detail__grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 14px;
    align-items: start;
  }

  .weft-registry-detail__message-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .weft-registry-detail__message-details {
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-md);
    padding: 8px 10px;
  }

  .weft-registry-detail__message-header {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    cursor: pointer;
  }

  .weft-registry-detail__message-name {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
    font-weight: 600;
    overflow-wrap: anywhere;
    min-width: 0;
  }

  .weft-registry-detail__message-body {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px 16px;
    margin-top: 10px;
  }

  .weft-registry-detail__message-schema-title {
    margin: 0 0 4px;
    font-size: var(--cinder-text-2xs);
    font-weight: 600;
    color: var(--cinder-text-subtle);
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .weft-registry-detail__panel {
    background: var(--cinder-surface-raised);
    border: 1px solid var(--cinder-border);
    border-radius: var(--cinder-radius-lg);
    padding: 14px 16px;
  }

  .weft-registry-detail__panel-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 0 0 10px;
    font-size: var(--cinder-text-sm);
    font-weight: 600;
  }

  .weft-registry-detail__panel-meta {
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
    font-family: var(--cinder-font-mono);
    font-weight: 400;
  }

  .weft-registry-detail__no-schema {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--cinder-text-subtle);
    font-size: var(--cinder-text-sm);
  }

  .weft-registry-detail__gap-note {
    margin: 0;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
  }

  .weft-schema-node {
    display: flex;
    align-items: center;
    gap: 9px;
    flex-wrap: wrap;
    min-width: 0;
  }

  .weft-schema-node__name {
    font-family: var(--cinder-font-mono);
    font-size: var(--cinder-text-sm);
    font-weight: 600;
    overflow-wrap: anywhere;
    min-width: 0;
  }

  .weft-schema-node__description {
    flex-basis: 100%;
    font-size: var(--cinder-text-xs);
    color: var(--cinder-text-subtle);
    overflow-wrap: anywhere;
  }

  :global(.weft-schema-node__requirement) {
    margin-inline-start: auto;
  }
</style>
