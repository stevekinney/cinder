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
    onValueChange,
    class: className,
    autofocus = false,
    'aria-describedby': consumerDescribedBy,
    'aria-invalid': consumerInvalid,
    ...rest
  }: JsonEditorProps = $props();

  let draftValue = $state(value);
  let previousValue = value;
  let textareaNode: HTMLTextAreaElement | undefined = $state();
  let resetSyncTimeout: ReturnType<typeof setTimeout> | undefined;

  $effect(() => {
    if (value === previousValue) return;
    previousValue = value;
    draftValue = value;
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
</script>

<div class={classNames('cinder-json-editor', className)}>
  <label class="cinder-json-editor__label" for={id}>{label}</label>
  {#if description}
    <p id={descriptionId} class="cinder-json-editor__description">{description}</p>
  {/if}
  <textarea
    bind:this={textareaNode}
    {...rest}
    {id}
    {rows}
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
    {@attach (element) => {
      if (autofocus) element.focus();
    }}
  ></textarea>
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
