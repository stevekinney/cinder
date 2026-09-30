import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const chatHydration = process.env['CINDER_CHAT_DEV_HYDRATION'] === '1';

export default defineConfig({
  ...(chatHydration
    ? { ssr: { optimizeDeps: { include: ['@lostgradient/chat'] } } }
    : { optimizeDeps: { holdUntilCrawlEnd: false, noDiscovery: true } }),
  plugins: [sveltekit()],
});
