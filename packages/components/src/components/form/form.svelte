<script lang="ts" module>
  /**
   * @cinder
   * @category form
   * @status beta
   * @purpose Thin form root that owns asynchronous submit state and prevents duplicate submissions while preserving native form behavior.
   * @tag form
   * @tag submit
   * @useWhen A form needs a shared pending state while an asynchronous submit handler runs.
   * @avoidWhen Submission is entirely native and no pending UI needs to be coordinated.
   * @related form-field, button
   */
  export type { FormProps, FormSubmitContext } from './form.types.ts';
</script>

<script lang="ts">
  import type { FormProps } from './form.types.ts';
  import { classNames } from '../../utilities/class-names.ts';

  let { onSubmit, children, class: className, ...rest }: FormProps = $props();
  let submitting = $state(false);

  async function handleSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!onSubmit || submitting) return;
    submitting = true;
    try {
      await onSubmit(event);
    } finally {
      submitting = false;
    }
  }
</script>

<form
  {...rest}
  class={classNames('cinder-form', className)}
  data-cinder-submitting={submitting ? '' : undefined}
  onsubmit={handleSubmit}
>
  {@render children?.({ submitting })}
</form>
