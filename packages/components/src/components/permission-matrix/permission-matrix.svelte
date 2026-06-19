<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status alpha
   * @purpose Categorical permission matrix for scanning discrete access states across scopes and operations.
   * @tag matrix
   * @tag permission
   * @tag authorization
   * @tag table
   * @useWhen Showing whether scopes, roles, or policy categories grant specific operations.
   * @useWhen Each cell represents a discrete state such as granted, denied, or not applicable.
   * @avoidWhen Showing numeric density or magnitude across two categorical dimensions — use matrix-chart instead.
   * @avoidWhen Rendering editable permissions — use a purpose-built form or data-grid instead.
   * @related matrix-chart, data-grid, table
   */
  export type {
    PermissionMatrixAxisItem,
    PermissionMatrixCellState,
    PermissionMatrixProps,
    PermissionMatrixSchemaProps,
    PermissionMatrixStateLabels,
  } from './permission-matrix.types.ts';
</script>

<script lang="ts">
  import Check from 'lucide-svelte/icons/check';
  import LockKeyhole from 'lucide-svelte/icons/lock-keyhole';
  import Minus from 'lucide-svelte/icons/minus';

  import { classNames } from '../../utilities/class-names.ts';

  import type {
    PermissionMatrixAxisItem,
    PermissionMatrixCellState,
    PermissionMatrixProps,
  } from './permission-matrix.types.ts';

  let {
    label,
    description,
    rows,
    columns,
    getCellState,
    onCellClick,
    stateLabels,
    rowHeaderLabel = 'Scope',
    loading = false,
    class: customClassName,
    empty,
    loadingContent,
    id,
    ...rest
  }: PermissionMatrixProps = $props();

  const generatedId = $props.id();
  const rootId = $derived(id ?? generatedId);
  const descriptionId = $derived(description ? `${rootId}-description` : undefined);
  const isEmpty = $derived(rows.length === 0 || columns.length === 0);

  const defaultStateLabels: Record<PermissionMatrixCellState, string> = {
    granted: 'granted',
    denied: 'denied',
    'not-applicable': 'not applicable',
  };

  const mergedStateLabels = $derived({
    ...defaultStateLabels,
    ...(stateLabels ?? {}),
  } satisfies Record<PermissionMatrixCellState, string>);

  function stateLabel(state: PermissionMatrixCellState): string {
    return mergedStateLabels[state];
  }

  function cellLabel(
    row: PermissionMatrixAxisItem,
    column: PermissionMatrixAxisItem,
    state: PermissionMatrixCellState,
  ): string {
    return `${row.label} × ${column.label}: ${stateLabel(state)}`;
  }
</script>

<figure
  {...rest}
  id={rootId}
  class={classNames('cinder-permission-matrix', customClassName)}
  aria-label={label}
  aria-describedby={descriptionId}
>
  <figcaption class="cinder-permission-matrix__caption">{label}</figcaption>
  {#if description}
    <p id={descriptionId} class="cinder-permission-matrix__description">{description}</p>
  {/if}
  <div class="cinder-permission-matrix__viewport" data-cinder-loading={loading || undefined}>
    {#if loading}
      <div class="cinder-permission-matrix__state">
        {#if loadingContent}{@render loadingContent()}{:else}Loading matrix…{/if}
      </div>
    {:else if isEmpty}
      <div class="cinder-permission-matrix__state">
        {#if empty}{@render empty()}{:else}No matrix data{/if}
      </div>
    {:else}
      <div class="cinder-permission-matrix__scroll" data-cinder-scroll-container>
        <table class="cinder-permission-matrix__table">
          <caption class="cinder-sr-only">{label}</caption>
          <thead>
            <tr>
              <th class="cinder-permission-matrix__corner" scope="col">{rowHeaderLabel}</th>
              {#each columns as column (column.id)}
                <th class="cinder-permission-matrix__column-header" scope="col">
                  {column.label}
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each rows as row (row.id)}
              <tr>
                <th class="cinder-permission-matrix__row-header" scope="row">{row.label}</th>
                {#each columns as column (column.id)}
                  {@const state = getCellState(row, column)}
                  {@const accessibleLabel = cellLabel(row, column, state)}
                  {@const visibleLabel = stateLabel(state)}
                  <td
                    class="cinder-permission-matrix__cell"
                    data-cinder-state={state}
                    aria-label={accessibleLabel}
                  >
                    {#if onCellClick}
                      <button
                        type="button"
                        class="cinder-permission-matrix__cell-control"
                        aria-label={accessibleLabel}
                        data-cinder-row={row.id}
                        data-cinder-column={column.id}
                        data-cinder-state={state}
                        onclick={() => onCellClick(row, column, state)}
                      >
                        <span class="cinder-permission-matrix__cell-token" aria-hidden="true">
                          {#if state === 'granted'}
                            <Check size={16} strokeWidth={2.25} />
                          {:else if state === 'denied'}
                            <LockKeyhole size={16} strokeWidth={2.25} />
                          {:else}
                            <Minus size={16} strokeWidth={2.25} />
                          {/if}
                        </span>
                        <span class="cinder-permission-matrix__cell-label">{visibleLabel}</span>
                      </button>
                    {:else}
                      <span
                        class="cinder-permission-matrix__cell-control"
                        data-cinder-row={row.id}
                        data-cinder-column={column.id}
                        data-cinder-state={state}
                      >
                        <span class="cinder-permission-matrix__cell-token" aria-hidden="true">
                          {#if state === 'granted'}
                            <Check size={16} strokeWidth={2.25} />
                          {:else if state === 'denied'}
                            <LockKeyhole size={16} strokeWidth={2.25} />
                          {:else}
                            <Minus size={16} strokeWidth={2.25} />
                          {/if}
                        </span>
                        <span class="cinder-permission-matrix__cell-label">{visibleLabel}</span>
                      </span>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>
</figure>
