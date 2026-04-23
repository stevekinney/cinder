<script lang="ts">
  import { Button } from 'cinder';
  import type { ButtonVariant, ButtonSize } from 'cinder';
  import '../app.css';

  const variants: ButtonVariant[] = ['primary', 'secondary', 'danger', 'ghost'];
  const sizes: ButtonSize[] = ['xs', 'sm', 'md', 'lg'];
</script>

<main>
  <h1>cinder sveltekit consumer fixture</h1>

  <section>
    <h2>variants</h2>
    {#each variants as variant (variant)}
      <Button {variant} label={variant} />
    {/each}
  </section>

  <section>
    <h2>sizes</h2>
    {#each sizes as size (size)}
      <Button variant="primary" {size} label={size} />
    {/each}
  </section>

  <section>
    <h2>link variant</h2>
    <Button href="/about" label="an anchor button" />
  </section>
</main>
