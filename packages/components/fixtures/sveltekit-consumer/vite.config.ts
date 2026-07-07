import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    holdUntilCrawlEnd: false,
    noDiscovery: true,
  },
  plugins: [sveltekit()],
});
