import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://inexistence.github.io',
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    react(),
    sitemap({
      filter: (page) => !/\/\d{4}\/\d{2}\/\d{2}\//.test(new URL(page).pathname),
    }),
  ],
  vite: {
    resolve: {
      noExternal: ['animal-island-ui'],
    },
    ssr: {
      noExternal: ['animal-island-ui'],
    },
  },
  markdown: {
    shikiConfig: {
      theme: 'github-light',
      wrap: true,
    },
  },
});
