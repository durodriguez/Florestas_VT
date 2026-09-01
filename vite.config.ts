import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));

// `base` matters for GitHub Pages project sites, where the app is served from
// https://<org>.github.io/<repo>/ rather than the domain root. Set BASE_PATH in
// CI (see .github/workflows/deploy.yml) or leave it unset for a root deploy.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      // Two apps from one build: the public map at /, and the field survey
      // PWA at /field/. They share the data pipeline and the deploy workflow.
      input: {
        main: resolve(__dirname, 'index.html'),
        field: resolve(__dirname, 'field/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
