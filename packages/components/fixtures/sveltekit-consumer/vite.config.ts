import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps:
    process.env['CINDER_CHAT_DEV_HYDRATION'] === '1'
      ? undefined
      : {
          holdUntilCrawlEnd: false,
          noDiscovery: true,
        },
  plugins: [sveltekit()],
});
