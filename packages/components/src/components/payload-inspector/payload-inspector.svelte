<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Composed inspector for structured payloads with summary, tree, and raw views, copy actions, and size/truncation status.
   * @tag json
   * @tag inspector
   * @tag payload
   * @useWhen Inspecting workflow inputs, signal payloads, activity results, or API response bodies in a dashboard.
   * @useWhen Displaying a structured payload with metadata like content type, source, and timestamp.
   * @avoidWhen Rendering a raw code block only — use code-block directly instead.
   * @avoidWhen Needing search, filtering, or virtualization over large collections — compose a custom viewer.
   * @related json-viewer, code-block, description-list, copy-button
   */
  export type {
    PayloadInspectorMeta,
    PayloadInspectorProps,
    PayloadInspectorSchemaProps,
    PayloadInspectorSchemaValue,
    PayloadInspectorView,
  } from './payload-inspector.types.ts';
</script>

<script lang="ts">
  import type { PayloadInspectorProps } from './payload-inspector.types.ts';
  import type { DescriptionListItem } from '../description-list/description-list.types.ts';

  import Badge from '../badge/badge.svelte';
  import CodeBlock from '../code-block/code-block.svelte';
  import CopyButton from '../copy-button/copy-button.svelte';
  import DescriptionList from '../description-list/description-list.svelte';
  import JsonViewer from '../json-viewer/json-viewer.svelte';
  import Tabs from '../tabs/tabs.svelte';
  import TabList from '../tab-list/tab-list.svelte';
  import Tab from '../tab/tab.svelte';
  import TabPanel from '../tab-panel/tab-panel.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    value,
    truncated = false,
    maxBytes = 1_048_576,
    meta,
    format,
    parse,
    activeView = $bindable('summary'),
    label = 'Payload inspector',
    class: className,
    ...rest
  }: PayloadInspectorProps = $props();

  // --------------------------------------------------------------------------
  // Parsing: when value is a string, attempt to parse it as JSON (or with the
  // custom parser). On failure, mark as invalid so we can show an error state.
  // --------------------------------------------------------------------------

  type ParseResult = { ok: true; parsed: unknown } | { ok: false; error: string };

  const parseResult = $derived.by((): ParseResult => {
    if (typeof value !== 'string') {
      return { ok: true, parsed: value };
    }
    // Empty string is treated as null/absent rather than an error.
    if (value.trim() === '') {
      return { ok: true, parsed: null };
    }
    try {
      const parser = parse ?? JSON.parse;
      return { ok: true, parsed: parser(value) };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const parsedValue = $derived(parseResult.ok ? parseResult.parsed : undefined);

  // --------------------------------------------------------------------------
  // Serialized size — compute once from the canonical in-memory value so that
  // size display and the oversize gate are consistent with each other.
  // --------------------------------------------------------------------------

  type SizeResult = { ok: true; bytes: number } | { ok: false };

  const sizeResult = $derived.by((): SizeResult => {
    if (!parseResult.ok) return { ok: false };
    try {
      const json = JSON.stringify(parsedValue);
      if (typeof json !== 'string') return { ok: false };
      return { ok: true, bytes: new Blob([json]).size };
    } catch {
      return { ok: false };
    }
  });

  const byteLabel = $derived.by((): string => {
    if (!sizeResult.ok) return 'Unknown size';
    const bytes = sizeResult.bytes;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  });

  // --------------------------------------------------------------------------
  // Formatted raw text for the raw view.
  //
  // `format` controls how the raw view *displays* the payload — it is a
  // serializer (e.g. sorted keys, custom indentation) not a redaction hook.
  // Redaction should happen upstream: pass the already-redacted object as
  // `value` so every view (Summary, Tree, Raw) sees the redacted form.
  // --------------------------------------------------------------------------

  const rawText = $derived.by((): string => {
    if (!parseResult.ok) {
      // Show the original string if we have one (so the user can see what failed to parse).
      return typeof value === 'string' ? value : '';
    }
    try {
      const formatter = format ?? ((v: unknown) => JSON.stringify(v, null, 2));
      return formatter(parsedValue) ?? '';
    } catch {
      return typeof value === 'string' ? value : '';
    }
  });

  // True when the in-memory value cannot be round-tripped through JSON.stringify
  // (e.g. circular references, BigInt). Only fires for non-string values that
  // parsed successfully — string parse errors are handled by parseResult.ok.
  const unserializable = $derived.by((): boolean => {
    if (typeof value === 'string' || !parseResult.ok) return false;
    try {
      JSON.stringify(parsedValue);
      return false;
    } catch {
      return true;
    }
  });

  // --------------------------------------------------------------------------
  // Summary metadata items for DescriptionList.
  // --------------------------------------------------------------------------

  const summaryItems = $derived.by((): DescriptionListItem[] => {
    const items: DescriptionListItem[] = [];
    items.push({ term: 'Size', definition: byteLabel });

    if (meta?.contentType) {
      items.push({ term: 'Content type', definition: meta.contentType });
    }
    if (meta?.source) {
      items.push({ term: 'Source', definition: meta.source });
    }
    if (meta?.timestamp) {
      // Attempt to format as a locale string; fall back to raw string.
      let displayTime = meta.timestamp;
      try {
        displayTime = new Date(meta.timestamp).toLocaleString();
      } catch {
        // leave as-is
      }
      items.push({ term: 'Timestamp', definition: displayTime });
    }
    return items;
  });

  // --------------------------------------------------------------------------
  // Type classification for the summary type badge.
  // --------------------------------------------------------------------------

  type ValueKind =
    | 'null'
    | 'undefined'
    | 'boolean'
    | 'number'
    | 'string'
    | 'array'
    | 'object'
    | 'invalid';

  const valueKind = $derived.by((): ValueKind => {
    if (!parseResult.ok) return 'invalid';
    const v = parsedValue;
    if (v === null) return 'null';
    if (v === undefined) return 'undefined';
    if (typeof v === 'boolean') return 'boolean';
    if (typeof v === 'number') return 'number';
    if (typeof v === 'string') return 'string';
    if (Array.isArray(v)) return 'array';
    return 'object';
  });

  // --------------------------------------------------------------------------
  // Whether the value is a primitive (shown inline in the summary).
  // --------------------------------------------------------------------------

  const isPrimitive = $derived(
    valueKind === 'null' ||
      valueKind === 'undefined' ||
      valueKind === 'boolean' ||
      valueKind === 'number' ||
      valueKind === 'string',
  );

  const isEmpty = $derived(parsedValue === undefined && value === undefined);

  // --------------------------------------------------------------------------
  // Copy targets for the header copy buttons.
  //
  // copy-raw  → "payload as received": the original string verbatim if value
  //             was a string, otherwise compact JSON (one-liner, no spaces).
  //             This is what you would paste into a message bus or log query.
  //
  // copy-formatted → pretty-printed JSON of the parsed value (2-space indent).
  //                  Ignores the `format` prop so it is always valid JSON.
  //                  This is what you would read or diff in an editor.
  // --------------------------------------------------------------------------

  const copyRawText = $derived.by((): string => {
    if (typeof value === 'string') return value;
    if (!parseResult.ok) return '';
    try {
      return JSON.stringify(parsedValue) ?? '';
    } catch {
      return '';
    }
  });

  const copyFormattedText = $derived.by((): string => {
    if (!parseResult.ok) return rawText;
    try {
      return JSON.stringify(parsedValue, null, 2) ?? '';
    } catch {
      return rawText;
    }
  });

  const canCopyFormatted = $derived(!isEmpty && parseResult.ok && !unserializable);
  const canCopyRaw = $derived(!isEmpty && (typeof value === 'string' || canCopyFormatted));

  // --------------------------------------------------------------------------
  // Helper: badge variant for the type tag.
  // --------------------------------------------------------------------------

  function kindVariant(kind: ValueKind): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
    if (kind === 'invalid') return 'danger';
    if (kind === 'null' || kind === 'undefined') return 'warning';
    if (kind === 'object' || kind === 'array') return 'info';
    return 'neutral';
  }

  // --------------------------------------------------------------------------
  // Computed active view binding — keep activeView in sync with $bindable.
  // Because Tabs uses bind:value internally, we forward the $bindable to it
  // directly. The Tabs bind creates a two-way link that keeps activeView
  // updated when the user switches tabs, and respects external changes too.
  // --------------------------------------------------------------------------
</script>

<section {...rest} class={classNames('cinder-payload-inspector', className)} aria-label={label}>
  <!-- Header bar: label, size, copy actions -->
  <div class="cinder-payload-inspector__header">
    <span class="cinder-payload-inspector__label">{label}</span>
    <div class="cinder-payload-inspector__header-actions">
      {#if sizeResult.ok}
        <span class="cinder-payload-inspector__size" aria-label={`${byteLabel} payload size`}>
          {byteLabel}
        </span>
      {/if}
      {#if truncated}
        <Badge variant="warning" size="xs">Truncated</Badge>
      {/if}
      {#if canCopyFormatted}
        <CopyButton
          value={copyFormattedText}
          label="Copy formatted"
          copiedLabel="Formatted copied"
          title="Copy formatted payload"
          iconOnly
        />
      {/if}
      {#if canCopyRaw}
        <CopyButton
          value={copyRawText}
          label="Copy raw"
          copiedLabel="Raw copied"
          title="Copy raw payload"
          iconOnly
        />
      {/if}
    </div>
  </div>

  <!-- Tab switcher: Summary / Tree / Raw -->
  <div class="cinder-payload-inspector__tabs">
    <Tabs bind:value={activeView}>
      <TabList label="Inspector views">
        <Tab value="summary">Summary</Tab>
        <Tab value="tree">Tree</Tab>
        <Tab value="raw">Raw</Tab>
      </TabList>

      <!-- Summary panel -->
      <TabPanel value="summary">
        <div class="cinder-payload-inspector__panel">
          {#if isEmpty}
            <div class="cinder-payload-inspector__empty" role="status">No payload</div>
          {/if}
          {#if !isEmpty}
            <div class="cinder-payload-inspector__summary">
              <div class="cinder-payload-inspector__summary-badges">
                <Badge variant={kindVariant(valueKind)} size="xs" mono>{valueKind}</Badge>
                {#if truncated}
                  <Badge variant="warning" size="xs">Truncated</Badge>
                {/if}
              </div>
              {#if summaryItems.length > 0}
                <DescriptionList items={summaryItems} variant="two-column" />
              {/if}
              {#if !parseResult.ok}
                <div
                  class="cinder-payload-inspector__notice cinder-payload-inspector__notice--warning"
                  role="alert"
                >
                  Parse error: {parseResult.error}
                </div>
              {/if}
              {#if parseResult.ok && isPrimitive}
                <div class="cinder-payload-inspector__summary-value">
                  <span class="cinder-payload-inspector__summary-value-label">Value</span>
                  <span class="cinder-payload-inspector__primitive">{String(parsedValue)}</span>
                </div>
              {/if}
            </div>
          {/if}
        </div>
      </TabPanel>

      <!-- Tree panel -->
      <TabPanel value="tree">
        <div class="cinder-payload-inspector__panel">
          {#if isEmpty}
            <div class="cinder-payload-inspector__empty" role="status">No payload</div>
          {/if}
          {#if !isEmpty && !parseResult.ok}
            <div
              class="cinder-payload-inspector__notice cinder-payload-inspector__notice--warning"
              role="alert"
            >
              Cannot render tree: {parseResult.error}
            </div>
          {/if}
          {#if !isEmpty && parseResult.ok && unserializable}
            <div class="cinder-payload-inspector__notice" role="status">
              This value can't be serialized as JSON (it may contain circular references or BigInt
              values).
            </div>
          {/if}
          {#if !isEmpty && parseResult.ok && !unserializable}
            <JsonViewer value={parsedValue} {maxBytes} />
          {/if}
        </div>
      </TabPanel>

      <!-- Raw panel -->
      <TabPanel value="raw">
        <div class="cinder-payload-inspector__panel cinder-payload-inspector__panel--code">
          {#if isEmpty}
            <div class="cinder-payload-inspector__empty" role="status">No payload</div>
          {/if}
          {#if !isEmpty && truncated}
            <div class="cinder-payload-inspector__notice cinder-payload-inspector__notice--warning">
              This payload has been truncated by the producer. The raw view shows only the received
              portion.
            </div>
          {/if}
          {#if !isEmpty && unserializable}
            <div class="cinder-payload-inspector__notice" role="status">
              This value can't be serialized as JSON (it may contain circular references or BigInt
              values).
            </div>
          {/if}
          {#if !isEmpty && !unserializable}
            <!-- highlight={false} is an absolute off-switch: no Shiki import,
                 guaranteed-escaped plaintext. Consumers who want highlighting can
                 pass a `format` function and swap in a custom view. -->
            <CodeBlock code={rawText} highlight={false} class="cinder-payload-inspector__raw" />
          {/if}
        </div>
      </TabPanel>
    </Tabs>
  </div>
</section>
