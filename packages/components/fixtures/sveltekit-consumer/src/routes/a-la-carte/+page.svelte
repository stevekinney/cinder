<script lang="ts">
  // À la carte CSS test: import button JS + button styles plus the required
  // tokens and foundation aggregators. The built CSS bundle for this route
  // should contain button selectors and `--cinder-button-*` custom properties
  // but should NOT contain accordion-specific selectors or custom properties.
  import Button from 'cinder/button';

  import 'cinder/styles/tokens';
  import 'cinder/styles/foundation';
  import 'cinder/button/styles';
</script>

<main>
  <h1>À la carte fixture</h1>
  <Button label="à la carte button" />
</main>
