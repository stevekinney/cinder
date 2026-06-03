<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status stable
   * @purpose Star rating control with bindable numeric value, optional half-star precision, and a non-interactive readonly display mode.
   * @tag form
   * @tag selection
   * @useWhen Letting the user score something on a small ordinal scale such as 1-5 stars.
   * @useWhen Displaying an existing rating in readonly mode alongside a count or average.
   * @avoidWhen Picking a value from a numeric continuum — use slider instead.
   * @avoidWhen Capturing a binary preference — use toggle or checkbox.
   * @related slider, segmented-control, radio-group, form-field
   */
  export type { RatingPrecision, RatingProps } from './rating.types.ts';
</script>

<script lang="ts">
  import type { RatingProps } from './rating.types.ts';

  import {
    ariaInvalid,
    composeDescribedBy,
    describeId,
    errorId as buildErrorId,
  } from '../../_internal/field-control.ts';
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';
  import { classNames } from '../../utilities/class-names.ts';
  import { devWarn } from '../../utilities/dev-warn.ts';

  let {
    id,
    value = $bindable(0),
    count = 5,
    precision = 'whole',
    label,
    hideLabel = false,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledBy,
    description,
    error,
    disabled,
    readonly = false,
    required,
    name,
    class: className,
    onchange,
  }: RatingProps = $props();

  const context = getFormFieldContext();

  /** Normalize `count` to an integer in `[1, 10]`, defaulting to 5 on bad input. */
  const normalizedCount = $derived.by(() => {
    if (!Number.isFinite(count)) return 5;
    const truncated = Math.trunc(count);
    if (truncated < 1) return 1;
    if (truncated > 10) return 10;
    return truncated;
  });

  const stepSize = $derived(precision === 'half' ? 0.5 : 1);

  /** Build the sorted list of valid commit values for the current precision. */
  const valueOptions = $derived.by(() => {
    const out: number[] = [];
    for (let step = stepSize; step <= normalizedCount + stepSize / 2; step += stepSize) {
      out.push(Number(step.toFixed(2)));
    }
    return out;
  });

  function snapToOption(raw: number): number {
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    if (raw >= normalizedCount) return normalizedCount;
    const stepped = Math.round(raw / stepSize) * stepSize;
    const rounded = Number(stepped.toFixed(2));
    return Math.max(0, Math.min(normalizedCount, rounded));
  }

  const resolvedValue = $derived(snapToOption(value ?? 0));

  // Mirror normalized value back onto the prop without firing onchange so
  // consumers always see a normalized number even when they pass garbage in.
  $effect(() => {
    if (resolvedValue !== value) {
      value = resolvedValue;
    }
  });

  let hoverValue = $state<number | null>(null);
  const displayValue = $derived(hoverValue ?? resolvedValue);

  const groupLabelId = $derived(label ? `${id}-label` : undefined);
  const defaultDescriptionId = $derived(describeId(id, !!description));
  const defaultErrorId = $derived(buildErrorId(id, !!error));
  const ownDescriptionId = $derived(
    description && defaultDescriptionId === context?.descriptionId
      ? `${id}-rating-description`
      : defaultDescriptionId,
  );
  const ownErrorId = $derived(
    error && defaultErrorId === context?.errorId ? `${id}-rating-error` : defaultErrorId,
  );
  const resolvedDescriptionId = $derived(ownDescriptionId ?? context?.descriptionId);
  const resolvedErrorId = $derived(ownErrorId ?? context?.errorId);
  const describedBy = $derived(composeDescribedBy(resolvedDescriptionId, resolvedErrorId));
  const resolvedAriaInvalid = $derived(error ? ariaInvalid(true) : context?.invalid);
  const resolvedRequired = $derived(required ?? context?.required ?? false);
  const resolvedDisabled = $derived(disabled ?? context?.disabled ?? false);

  const resolvedGroupLabelledBy = $derived.by(() => {
    if (groupLabelId) return groupLabelId;
    if (context?.labelId) return context.labelId;
    if (ariaLabelledBy) return ariaLabelledBy;
    return undefined;
  });

  const groupAriaLabel = $derived(
    !resolvedGroupLabelledBy && !ariaLabelledBy ? ariaLabel : undefined,
  );

  const hasGroupAccessibleName = $derived(
    !!label || !!context?.labelId || !!ariaLabelledBy || !!ariaLabel,
  );

  $effect(() => {
    if (!hasGroupAccessibleName) {
      devWarn(
        `[cinder/Rating] No accessible name source for id="${id}". Provide a label, aria-label, aria-labelledby, or wrap in a FormField.`,
      );
    }
  });

  function optionId(option: number): string {
    return `${id}-option-${String(option).replace('.', '_')}`;
  }

  function describeOption(option: number): string {
    const noun = option === 1 ? 'star' : 'stars';
    return `${option} ${noun} of ${normalizedCount}`;
  }

  function readableValueText(): string {
    if (resolvedValue === 0) return `Unrated, out of ${normalizedCount}`;
    const noun = resolvedValue === 1 ? 'star' : 'stars';
    return `${resolvedValue} ${noun} out of ${normalizedCount}`;
  }

  const readonlyValueTextId = $derived(`${id}-rating-value`);

  /**
   * Compose the readonly container's accessible-name reference. The value
   * text MUST appear in the name — otherwise screen readers announce only
   * the consumer's field label and lose the actual rating. When there is no
   * DOM-backed label, fall back to `aria-label` so the value text still
   * surfaces (the visually-hidden span exists as redundant context for AT
   * stacks that ignore the role=img label).
   */
  const readonlyLabelledBy = $derived(
    resolvedGroupLabelledBy
      ? `${resolvedGroupLabelledBy} ${readonlyValueTextId}`
      : ariaLabelledBy
        ? `${ariaLabelledBy} ${readonlyValueTextId}`
        : undefined,
  );

  const readonlyAriaLabel = $derived.by(() => {
    if (readonlyLabelledBy) return undefined;
    const consumerLabel = ariaLabel;
    if (consumerLabel) return `${consumerLabel}: ${readableValueText()}`;
    return readableValueText();
  });

  function commit(next: number): void {
    const snapped = snapToOption(next);
    if (snapped !== resolvedValue) {
      value = snapped;
      onchange?.(snapped);
    } else {
      // Re-emit when the user re-selects the same value? No — keep
      // onchange aligned with React's <input> semantics: same value = no fire.
    }
  }

  function focusOption(option: number): void {
    if (typeof document === 'undefined') return;
    const element = document.getElementById(optionId(option));
    if (element instanceof HTMLElement) element.focus();
  }

  function activeFocusTarget(): number {
    if (resolvedValue > 0) return resolvedValue;
    const first = valueOptions[0];
    return first ?? stepSize;
  }

  function handleClick(option: number): void {
    if (resolvedDisabled || readonly) return;
    commit(option);
  }

  function handleKeyDown(event: KeyboardEvent, option: number): void {
    if (resolvedDisabled || readonly) return;
    const index = valueOptions.indexOf(option);
    if (index === -1) return;
    let nextIndex = index;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp': {
        nextIndex = (index + 1) % valueOptions.length;
        if (resolvedValue === 0) {
          // unrated: commit the first option without wrapping past it
          event.preventDefault();
          const first = valueOptions[0]!;
          commit(first);
          focusOption(first);
          return;
        }
        break;
      }
      case 'ArrowLeft':
      case 'ArrowDown': {
        if (resolvedValue === 0) {
          event.preventDefault();
          const last = valueOptions.at(-1)!;
          commit(last);
          focusOption(last);
          return;
        }
        nextIndex = (index - 1 + valueOptions.length) % valueOptions.length;
        break;
      }
      case 'Home': {
        nextIndex = 0;
        break;
      }
      case 'End': {
        nextIndex = valueOptions.length - 1;
        break;
      }
      case ' ':
      case 'Enter':
      case 'Spacebar': {
        if (resolvedValue === 0) {
          event.preventDefault();
          const first = valueOptions[0]!;
          commit(first);
          focusOption(first);
          return;
        }
        event.preventDefault();
        commit(option);
        return;
      }
      default:
        return;
    }
    event.preventDefault();
    const next = valueOptions[nextIndex]!;
    commit(next);
    focusOption(next);
  }

  function handlePointerEnter(option: number): void {
    if (resolvedDisabled || readonly) return;
    hoverValue = option;
  }

  function handlePointerLeave(): void {
    hoverValue = null;
  }

  function fillPercentForSlot(slot: number): number {
    // slot is 1..normalizedCount. Return fill percentage 0..100 for that star
    // based on displayValue.
    const diff = displayValue - (slot - 1);
    if (diff <= 0) return 0;
    if (diff >= 1) return 100;
    return diff * 100;
  }

  function isOptionChecked(option: number): boolean {
    return resolvedValue === option;
  }

  function tabIndexFor(option: number): 0 | -1 {
    if (resolvedDisabled) return -1;
    const focusTarget = activeFocusTarget();
    return option === focusTarget ? 0 : -1;
  }
</script>

<div
  class={classNames('cinder-rating-field', readonly && 'cinder-rating-field--readonly', className)}
  data-cinder-disabled={resolvedDisabled || undefined}
>
  {#if label}
    <span
      id={groupLabelId}
      class={classNames('cinder-rating-field__label', hideLabel && 'cinder-sr-only')}
      data-disabled={resolvedDisabled || undefined}
    >
      {label}
    </span>
  {/if}

  {#if readonly}
    <div
      class="cinder-rating cinder-rating--readonly"
      role="img"
      aria-labelledby={readonlyLabelledBy}
      aria-label={readonlyAriaLabel}
      aria-describedby={describedBy}
    >
      {#each Array.from({ length: normalizedCount }, (_, i) => i + 1) as slot (slot)}
        <span class="cinder-rating__star" aria-hidden="true">
          <span
            class="cinder-rating__star-fill"
            style:--_cinder-rating-fill="{fillPercentForSlot(slot)}%"
          ></span>
        </span>
      {/each}
      <span id={readonlyValueTextId} class="cinder-sr-only">{readableValueText()}</span>
    </div>
  {:else}
    <div
      class="cinder-rating"
      role="radiogroup"
      tabindex="-1"
      aria-labelledby={resolvedGroupLabelledBy}
      aria-label={groupAriaLabel}
      aria-describedby={describedBy}
      aria-invalid={resolvedAriaInvalid}
      aria-required={resolvedRequired || undefined}
      aria-disabled={resolvedDisabled || undefined}
      onpointerleave={handlePointerLeave}
    >
      {#each Array.from({ length: normalizedCount }, (_, i) => i + 1) as slot (slot)}
        <span class="cinder-rating__star" aria-hidden="true">
          <span
            class="cinder-rating__star-fill"
            style:--_cinder-rating-fill="{fillPercentForSlot(slot)}%"
          ></span>
        </span>
      {/each}

      <div class="cinder-rating__hit-area">
        {#each valueOptions as option (option)}
          <button
            id={optionId(option)}
            class="cinder-rating__option"
            type="button"
            role="radio"
            aria-checked={isOptionChecked(option)}
            aria-label={describeOption(option)}
            tabindex={tabIndexFor(option)}
            disabled={resolvedDisabled || undefined}
            data-cinder-rating-option={option}
            onclick={() => handleClick(option)}
            onkeydown={(event) => handleKeyDown(event, option)}
            onpointerenter={() => handlePointerEnter(option)}
            onblur={handlePointerLeave}
          ></button>
        {/each}
      </div>
    </div>
  {/if}

  {#if name}
    <input
      type="hidden"
      {name}
      value={resolvedValue}
      required={resolvedRequired}
      disabled={resolvedDisabled}
    />
  {/if}

  {#if description}
    <p id={ownDescriptionId} class="cinder-rating-field__description">{description}</p>
  {/if}

  {#if error}
    <p id={ownErrorId} class="cinder-rating-field__error" aria-live="polite" aria-atomic="true">
      {error}
    </p>
  {/if}
</div>
