<script lang="ts" module>
  export const title = 'Async source';
  export const description =
    'Remote-style source with a loading row and stale-request cancellation.';
</script>

<script lang="ts">
  import Autocomplete from '@lostgradient/cinder/autocomplete';

  let { mountIdPrefix }: { mountIdPrefix?: string } = $props();
  const uid = $props.id();
  let fieldId = $derived(`${mountIdPrefix ?? uid}-field`);

  const cities = [
    { value: 'Austin, Texas', description: 'United States' },
    { value: 'Auckland, New Zealand', description: 'New Zealand' },
    { value: 'Aurora, Colorado', description: 'United States' },
    { value: 'Berlin, Germany', description: 'Germany' },
    { value: 'Bristol, England', description: 'United Kingdom' },
  ];

  let value = $state('');

  async function suggestionSource(query: string, context: { signal: AbortSignal }) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, 350);
      context.signal.addEventListener(
        'abort',
        () => {
          clearTimeout(timeout);
          reject(new DOMException('Aborted', 'AbortError'));
        },
        { once: true },
      );
    });

    return cities.filter((city) => city.value.toLowerCase().includes(query.toLowerCase()));
  }
</script>

<Autocomplete
  id={fieldId}
  label="Destination city"
  placeholder="Type a city"
  {suggestionSource}
  bind:value
/>
