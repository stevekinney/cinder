<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Controlled free-form JSON text editor with native textarea fallback, parse feedback, and accessible field wiring.
   * @tag form
   * @tag json
   * @tag editor
   * @useWhen Editing arbitrary JSON source while preserving the exact string in parent-owned state.
   * @useWhen A lightweight native editor is preferable to shipping a code-editor runtime.
   * @avoidWhen Editing a JSON Schema with guided form and diff views. | json-schema-editor
   * @avoidWhen Displaying JSON without allowing changes. | json-viewer
   * @related textarea, json-schema-editor, json-viewer
   * @keyboardShortcut Tab | Moves focus out of the editor without trapping the keyboard.
   * @a11yNote Uses a native textarea with a programmatic label and announced parse feedback.
   */
  export type { JsonEditorProps } from './json-editor.types.ts';
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { composeDescribedBy } from '../../_internal/field-control.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import type { JsonEditorProps } from './json-editor.types.ts';

  let {
    id,
    value,
    label,
    description,
    error,
    rows = 8,
    showValidFeedback = true,
    highlight = false,
    onValueChange,
    class: className,
    autofocus = false,
    wrap,
    onscroll: consumerOnScroll,
    'aria-describedby': consumerDescribedBy,
    'aria-invalid': consumerInvalid,
    ...rest
  }: JsonEditorProps = $props();

  let draftValue = $state(value);
  let previousValue = value;
  let textareaNode: HTMLTextAreaElement | undefined = $state();
  let resetSyncTimeout: ReturnType<typeof setTimeout> | undefined;
  let highlightedHtml = $state<string | null>(null);
  let lintPosition = $state<number | null>(null);
  let highlightNode: HTMLElement | undefined = $state();

  $effect(() => {
    if (value === previousValue) return;
    previousValue = value;
    draftValue = value;
  });

  $effect(() => {
    if (!highlight || externalError) {
      highlightedHtml = null;
      lintPosition = null;
      return;
    }

    const pendingValue = draftValue;
    let cancelled = false;
    void import('@lostgradient/cinder/json-editor/enhancement')
      .then(({ enhanceJson }) => {
        if (cancelled) return;
        const result = enhanceJson(pendingValue, parseIsValid);
        highlightedHtml = result.html;
        lintPosition = result.lint?.position ?? null;
        void tick().then(() => {
          if (!cancelled && highlightNode && textareaNode) {
            highlightNode.scrollTop = textareaNode.scrollTop;
            highlightNode.scrollLeft = textareaNode.scrollLeft;
          }
        });
      })
      .catch(() => {
        if (!cancelled) {
          highlightedHtml = null;
          lintPosition = null;
        }
      });

    return () => {
      cancelled = true;
    };
  });

  function syncDraftAfterFormReset(): void {
    if (resetSyncTimeout !== undefined) clearTimeout(resetSyncTimeout);
    resetSyncTimeout = setTimeout(() => {
      resetSyncTimeout = undefined;
      if (textareaNode) draftValue = textareaNode.value;
    }, 0);
  }

  $effect(() => {
    const form = textareaNode?.form;
    if (!form) return;

    form.addEventListener('reset', syncDraftAfterFormReset);
    return () => {
      form.removeEventListener('reset', syncDraftAfterFormReset);
      if (resetSyncTimeout !== undefined) {
        clearTimeout(resetSyncTimeout);
        resetSyncTimeout = undefined;
      }
    };
  });

  const descriptionId = $derived(description ? `${id}-description` : undefined);
  const externalError = $derived(error || undefined);
  const parseIsValid = $derived.by(() => {
    try {
      JSON.parse(draftValue);
      return true;
    } catch {
      return false;
    }
  });
  const feedbackIsError = $derived(Boolean(externalError) || !parseIsValid);
  const normalizedConsumerInvalid = $derived(consumerInvalid ?? undefined);
  const consumerMarksInvalid = $derived(
    normalizedConsumerInvalid !== undefined &&
      normalizedConsumerInvalid !== false &&
      normalizedConsumerInvalid !== 'false',
  );
  const feedbackText = $derived(
    externalError ??
      (!parseIsValid
        ? 'Enter valid JSON.'
        : showValidFeedback && !consumerMarksInvalid
          ? 'Valid JSON.'
          : undefined),
  );
  const feedbackId = $derived(feedbackText ? `${id}-feedback` : undefined);
  const describedBy = $derived(composeDescribedBy(descriptionId, feedbackId, consumerDescribedBy));
  const ariaInvalid = $derived(feedbackIsError ? 'true' : normalizedConsumerInvalid);
  const hasHighlightOverlay = $derived(highlight && highlightedHtml !== null);
</script>

<div class={classNames('cinder-json-editor', className)}>
  <label class="cinder-json-editor__label" for={id}>{label}</label>
  {#if description}
    <p id={descriptionId} class="cinder-json-editor__description">{description}</p>
  {/if}
  <div
    class={classNames(
      'cinder-json-editor__input',
      hasHighlightOverlay && 'cinder-json-editor__input--highlighted',
      wrap === 'off' && 'cinder-json-editor__input--nowrap',
    )}
    data-cinder-json-lint-position={lintPosition ?? undefined}
  >
    {#if hasHighlightOverlay}
      <pre
        bind:this={highlightNode}
        class="cinder-json-editor__highlight"
        aria-hidden="true">{@html highlightedHtml}</pre>
    {/if}
    <textarea
      bind:this={textareaNode}
      {...rest}
      {id}
      {rows}
      {wrap}
      {autofocus}
      value={draftValue}
      spellcheck="false"
      class="cinder-json-editor__textarea"
      aria-describedby={describedBy}
      aria-invalid={ariaInvalid}
      oninput={(event) => {
        draftValue = event.currentTarget.value;
        onValueChange?.(draftValue);
      }}
      onscroll={(event) => {
        const textarea = event.currentTarget;
        if (!highlightNode) return;
        highlightNode.scrollTop = textarea.scrollTop;
        highlightNode.scrollLeft = textarea.scrollLeft;
        consumerOnScroll?.(event);
      }}
      {@attach (element) => {
        if (autofocus) element.focus();
      }}
    ></textarea>
  </div>
  {#if feedbackText}
    <p
      id={feedbackId}
      class={classNames(
        'cinder-json-editor__feedback',
        feedbackIsError && 'cinder-json-editor__feedback--error',
      )}
      role={feedbackIsError ? 'alert' : 'status'}
    >
      {feedbackText}
    </p>
  {/if}
</div>
