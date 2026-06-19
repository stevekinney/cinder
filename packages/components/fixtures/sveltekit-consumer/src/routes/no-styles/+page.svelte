<script lang="ts">
  // No-styles test: import only the button JS (no `@lostgradient/cinder/button/styles`,
  // no aggregators). The built CSS bundle for this route should contain button
  // selectors because component JS imports its CSS sidecar as a side effect.
  import Button from '@lostgradient/cinder/button';
</script>

<main>
  <h1>No-styles fixture</h1>
  <Button label="no styles button" />
</main>
