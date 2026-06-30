<script lang="ts" module>
  export const title = 'LogoCloud';
  export const description =
    'LogoCloud rendering a trusted-by strip with linked and unlinked logos.';
</script>

<script lang="ts">
  import { LogoCloud } from '@lostgradient/cinder/logo-cloud';

  const logos = [
    { name: 'Acme', src: 'https://placehold.co/180x64?text=Acme', href: '#' },
    { name: 'Orbit', src: 'https://placehold.co/180x64?text=Orbit', href: '#' },
    { name: 'Northline', src: 'https://placehold.co/180x64?text=Northline' },
    { name: 'Wave', src: 'https://placehold.co/180x64?text=Wave', href: '#' },
    { name: 'Summit', src: 'https://placehold.co/180x64?text=Summit' },
  ];
</script>

<LogoCloud title="Trusted by modern product teams" {logos} columns={5} />
