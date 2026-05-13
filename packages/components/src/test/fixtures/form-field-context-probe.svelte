<script lang="ts">
  import { getFormFieldContext } from '../../_internal/form-field-context.ts';

  const context = getFormFieldContext();
</script>

<!--
  Reads the FormFieldContext published by a parent <FormField> and writes each
  field onto data-* attributes so tests can query them deterministically.
  Each attribute is omitted (undefined) when the context value is undefined.
-->
<div
  data-probe
  data-control-id={context?.controlId}
  data-label-id={context?.labelId}
  data-described-by={context?.describedBy}
  data-description-id={context?.descriptionId}
  data-error-id={context?.errorId}
  data-invalid={context?.invalid}
  data-required={context?.required ? 'true' : undefined}
  data-disabled={context?.disabled ? 'true' : undefined}
></div>
