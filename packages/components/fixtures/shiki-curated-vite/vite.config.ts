import { resolve } from 'node:path';

export default {
  resolve: {
    alias: {
      '@lostgradient/cinder/highlighters/shiki/curated': resolve(
        import.meta.dirname,
        '../../src/highlighters/shiki/index.ts',
      ),
    },
  },
  build: { target: 'es2022' },
};
