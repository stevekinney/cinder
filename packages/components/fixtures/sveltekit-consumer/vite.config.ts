import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  ssr: {
    // Lucide ships Svelte component files behind JavaScript icon exports. Compile it
    // during SSR so adapter-node never parses a raw .svelte file as JavaScript.
    noExternal: ['lucide-svelte'],
  },
});
