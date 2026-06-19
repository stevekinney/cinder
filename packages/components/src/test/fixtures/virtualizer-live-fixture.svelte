<script lang="ts" module>
  export type VirtualizerLiveFixtureProps = {
    rowCount?: number;
    columnCount?: number;
    itemHeight?: number;
    rowHeight?: number;
    overscan?: number;
    treeHeight?: number;
    gridHeight?: number;
    gridWidth?: number;
    initialTreeScrollTop?: number;
    initialGridScrollTop?: number;
    initialGridScrollLeft?: number;
  };
</script>

<script lang="ts">
  import { TreeVirtualizer } from '../../_internal/use-virtualizer.svelte.ts';
  import { DataGridVirtualizationAdapter } from '../../components/data-grid/_internal/virtualization-adapter.svelte.ts';

  let {
    rowCount = 100,
    columnCount = 8,
    itemHeight = 20,
    rowHeight = 44,
    overscan = 1,
    treeHeight = 120,
    gridHeight = 152,
    gridWidth = 260,
    initialTreeScrollTop = 80,
    initialGridScrollTop = 196,
    initialGridScrollLeft = 140,
  }: VirtualizerLiveFixtureProps = $props();

  let treeElement = $state<HTMLElement | null>(null);
  let gridElement = $state<HTMLElement | null>(null);

  const treeVirtualizer = new TreeVirtualizer({
    getScrollElement: () => treeElement,
    getCount: () => rowCount,
    getItemKey: (index) => `tree-${index}`,
    getEstimatedSize: () => itemHeight,
    getOverscan: () => overscan,
    getInitialHeight: () => treeHeight,
  });

  const dataGridVirtualizer = new DataGridVirtualizationAdapter({
    getScrollElement: () => gridElement,
    getRowCount: () => rowCount,
    getRowKey: (index) => `row-${index}`,
    getRowHeight: () => rowHeight,
    getColumnCount: () => columnCount,
    getColumnKey: (index) => `column-${index}`,
    getColumnWidth: (index) => [80, 120, 60][index % 3] ?? 80,
    getOverscan: () => overscan,
    getInitialHeight: () => gridHeight,
    getInitialWidth: () => gridWidth,
    getScrollPaddingStart: () => 20,
    getScrollPaddingInlineStart: () => 10,
    getScrollPaddingInlineEnd: () => 15,
  });

  const treeItems = $derived(treeVirtualizer.virtualItems);
  const treeTotalSize = $derived(treeVirtualizer.totalSize);
  const gridRows = $derived(dataGridVirtualizer.virtualRows);
  const gridColumns = $derived(dataGridVirtualizer.virtualColumns);
  const gridTotalHeight = $derived(dataGridVirtualizer.totalHeight);
  const gridTotalWidth = $derived(dataGridVirtualizer.totalWidth);

  function setScrollGeometry(
    element: HTMLElement,
    {
      width,
      height,
      scrollTop,
      scrollLeft = 0,
    }: { width: number; height: number; scrollTop: number; scrollLeft?: number },
  ): void {
    Object.defineProperty(element, 'clientHeight', { configurable: true, value: height });
    Object.defineProperty(element, 'clientWidth', { configurable: true, value: width });
    element.scrollTop = scrollTop;
    element.scrollLeft = scrollLeft;
    element.getBoundingClientRect = () =>
      ({
        width,
        height,
        top: 0,
        right: width,
        bottom: height,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as DOMRect;
    Object.defineProperty(element, 'scrollTo', {
      configurable: true,
      value: (options?: ScrollToOptions | number, top?: number) => {
        element.dataset['scrollToCalls'] = String(
          Number.parseInt(element.dataset['scrollToCalls'] ?? '0', 10) + 1,
        );
        if (typeof options === 'number') {
          element.scrollLeft = options;
          element.scrollTop = typeof top === 'number' ? top : element.scrollTop;
        } else if (options) {
          element.scrollTop = typeof options.top === 'number' ? options.top : element.scrollTop;
          element.scrollLeft = typeof options.left === 'number' ? options.left : element.scrollLeft;
        }
        element.dataset['scrollToTop'] = String(element.scrollTop);
        element.dataset['scrollToLeft'] = String(element.scrollLeft);
        element.dispatchEvent(new Event('scroll'));
      },
    });
  }

  function attachTreeScrollElement(element: HTMLElement): () => void {
    setScrollGeometry(element, {
      width: 320,
      height: treeHeight,
      scrollTop: initialTreeScrollTop,
    });
    treeElement = element;
    const cleanup = treeVirtualizer.scrollElement(element);

    return () => {
      if (cleanup) cleanup();
      if (treeElement === element) treeElement = null;
    };
  }

  function attachGridScrollElement(element: HTMLElement): () => void {
    setScrollGeometry(element, {
      width: gridWidth,
      height: gridHeight,
      scrollTop: initialGridScrollTop,
      scrollLeft: initialGridScrollLeft,
    });
    gridElement = element;
    const cleanup = dataGridVirtualizer.mountScrollContainer(element);

    return () => {
      if (cleanup) cleanup();
      if (gridElement === element) gridElement = null;
    };
  }
</script>

<div
  data-testid="tree-scroll"
  style:height={`${treeHeight}px`}
  style:overflow="auto"
  {@attach attachTreeScrollElement}
>
  <div data-testid="tree-total" style:height={`${treeTotalSize}px`}>
    {#each treeItems as item (item.key)}
      <div
        data-testid="tree-item"
        data-index={item.index}
        data-cinder-virtual-index={item.index}
        data-start={item.start}
        style:height={`${item.size}px`}
        {@attach treeVirtualizer.measureElement}
      >
        Tree {item.index}
      </div>
    {/each}
  </div>
</div>
<button
  data-testid="tree-scroll-button"
  type="button"
  onclick={() => treeVirtualizer.scrollToIndex(40, { align: 'start' })}
>
  Scroll tree
</button>
<output data-testid="tree-indices">{treeItems.map((item) => item.index).join(',')}</output>

<div
  data-testid="grid-scroll"
  style:height={`${gridHeight}px`}
  style:width={`${gridWidth}px`}
  style:overflow="auto"
  {@attach attachGridScrollElement}
>
  <div
    data-testid="grid-total"
    style:height={`${gridTotalHeight}px`}
    style:width={`${gridTotalWidth}px`}
  >
    {#each gridRows as row (row.key)}
      <div
        data-testid="grid-row"
        data-index={row.index}
        data-cinder-virtual-index={row.index}
        data-start={row.start}
        style:height={`${row.size}px`}
        {@attach dataGridVirtualizer.measureElement}
      >
        {#each gridColumns as column (column.key)}
          <span data-testid="grid-cell" data-column-index={column.index}>
            {row.index}:{column.index}
          </span>
        {/each}
      </div>
    {/each}
  </div>
</div>
<button
  data-testid="grid-scroll-button"
  type="button"
  onclick={() => {
    dataGridVirtualizer.scrollToRow(10, { align: 'start' });
    dataGridVirtualizer.scrollToColumn(4, { align: 'start' });
  }}
>
  Scroll grid
</button>
<output data-testid="grid-row-indices">{gridRows.map((row) => row.index).join(',')}</output>
<output data-testid="grid-column-indices"
  >{gridColumns.map((column) => column.index).join(',')}</output
>
