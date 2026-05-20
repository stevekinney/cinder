<script lang="ts" module>
  export const title = 'Composed input — context inheritance';
  export const description =
    'Input inside FormField inherits aria-describedby and aria-invalid from context. ' +
    'Partial override: Input has its own description; FormField provides the error. ' +
    'Final aria-describedby joins both ids.';
</script>

<script lang="ts">
  import { FormField } from 'cinder/form-field';
  import { Input } from 'cinder/input';
  let username = $state('');
</script>

<!--
  FormField owns the error; Input has its own description.
  The Input's aria-describedby will be:
    "username-description username-error"
  where "username-description" comes from the Input's own description prop
  and "username-error" comes from the FormField's context.errorId.
-->
<FormField id="username" label="Username" error="Username is already taken." required>
  <Input
    id="username"
    bind:value={username}
    description="Letters, numbers, and underscores only."
    placeholder="cool_username"
  />
</FormField>
