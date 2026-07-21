<script lang="ts" module>
  /**
   * @cinder
   * @category data-display
   * @status stable
   * @purpose Compact inspector for structured payloads: a labeled tree view with a copy action and size/truncation status.
   * @tag json
   * @tag inspector
   * @tag payload
   * @useWhen Inspecting workflow inputs, signal payloads, activity results, or API response bodies in a dashboard.
   * @useWhen Displaying a structured payload with a visible label, byte size, and copy affordance.
   * @avoidWhen Rendering a raw code block only — use code-block directly instead.
   * @avoidWhen Needing search, filtering, or virtualization over large collections — compose a custom viewer.
   * @related json-viewer, code-block, copy-button
   */
  export type {
    PayloadInspectorProps,
    PayloadInspectorSchemaProps,
    PayloadInspectorSchemaValue,
  } from './payload-inspector.types.ts';
</script>

<script lang="ts">
  import type { PayloadInspectorProps } from './payload-inspector.types.ts';

  import Badge from '../badge/badge.svelte';
  import CopyButton from '../copy-button/copy-button.svelte';
  import JsonViewer from '../json-viewer/json-viewer.svelte';
  import { classNames } from '../../utilities/class-names.ts';

  let {
    value,
    truncated = false,
    initialDepth = 1,
    maxDepth = 50,
    maxBytes = 1_048_576,
    parse,
    label = 'Payload inspector',
    class: className,
    ...rest
  }: PayloadInspectorProps = $props();

  // --------------------------------------------------------------------------
  // Parsing: preserve plain string values, while still accepting serialized JSON
  // strings for object, array, and JSON primitive payloads.
  // --------------------------------------------------------------------------

  type ParseResult = { ok: true; parsed: unknown } | { ok: false; error: string };

  function shouldParseString(raw: string): boolean {
    const trimmed = raw.trim();
    if (/^[{\["]/.test(trimmed)) return true;
    return /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)$/.test(trimmed);
  }

  const parseResult = $derived.by((): ParseResult => {
    if (typeof value !== 'string') {
      return { ok: true, parsed: value };
    }
    // Empty string is treated as null/absent rather than an error.
    if (value.trim() === '') {
      return { ok: true, parsed: null };
    }
    if (parse === undefined && !shouldParseString(value)) {
      return { ok: true, parsed: value };
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

  const isEmpty = $derived(parsedValue === undefined && value === undefined);

  const isPrimitive = $derived(
    parsedValue === null ||
      typeof parsedValue === 'boolean' ||
      typeof parsedValue === 'number' ||
      typeof parsedValue === 'string',
  );

  // Copy target: the original string verbatim whenever the payload itself was
  // a string — including a JSON-encoded string primitive like '"hello"',
  // which parses to the bare string `hello` but should still copy as the
  // original input, not the unquoted parsed result. Everything else copies
  // as pretty-printed JSON of the parsed value.
  const copyText = $derived.by((): string => {
    if (!parseResult.ok) return typeof value === 'string' ? value : '';
    if (typeof value === 'string') return value;
    try {
      return JSON.stringify(parsedValue, null, 2) ?? '';
    } catch {
      return '';
    }
  });

  const canCopy = $derived(!isEmpty && copyText !== '');
</script>

<div {...rest} class={classNames('cinder-payload-inspector', className)}>
  <!-- Header bar: label, size, copy action -->
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
      {#if canCopy}
        <CopyButton
          value={copyText}
          label={`Copy ${label}`}
          copiedLabel="Copied"
          title={`Copy ${label}`}
          iconOnly
        />
      {/if}
    </div>
  </div>

  <div class="cinder-payload-inspector__panel">
    {#if isEmpty}
      <div class="cinder-payload-inspector__empty" role="status">No payload</div>
    {:else if !parseResult.ok}
      <div
        class="cinder-payload-inspector__notice cinder-payload-inspector__notice--warning"
        role="alert"
      >
        Parse error: {parseResult.error}
      </div>
      {#if typeof value === 'string'}
        <pre class="cinder-payload-inspector__primitive">{value}</pre>
      {/if}
    {:else if unserializable}
      <div class="cinder-payload-inspector__notice" role="status">
        This value can't be serialized as JSON (it may contain circular references or BigInt
        values).
      </div>
    {:else if isPrimitive}
      <pre class="cinder-payload-inspector__primitive">{String(parsedValue)}</pre>
    {:else}
      <JsonViewer value={parsedValue} {initialDepth} {maxDepth} {maxBytes} />
    {/if}
  </div>
</div>
