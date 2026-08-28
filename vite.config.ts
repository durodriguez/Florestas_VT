import { defineConfig } from 'vite';

// `base` matters for GitHub Pages project sites, where the app is served from
// https://<org>.github.io/<repo>/ rather than the domain root. Set BASE_PATH in
// CI (see .github/workflows/deploy.yml) or leave it unset for a root deploy.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: {
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    port: 5173,
    open: true,
  },
});
