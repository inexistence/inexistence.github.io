import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { unified } from '@astrojs/markdown-remark';
import { sharedRemarkPlugins, sharedShikiConfig } from './src/lib/markdown-config.mjs';

const subsetAnimalIslandFonts = () => ({
  name: 'subset-animal-island-fonts',
  enforce: 'pre',
  transform(code, id) {
    if (!id.endsWith('/animal-island-ui/dist/index.css')) return null;

    return {
      code: code.replace(/@font-face\{[^}]*\}/g, (rule) => {
        if (!rule.includes('font-family:Noto Sans SC')) return rule;
        if (rule.includes('noto-sans-sc-chinese-simplified')) return '';

        return rule.replace('}', ';unicode-range:U+0000-024F}');
      }),
      map: null,
    };
  },
});

export default defineConfig({
  site: 'https://inexistence.github.io',
  output: 'static',
  trailingSlash: 'always',
  integrations: [
    mdx(),
    react(),
    sitemap({
      filter: (page) => !/\/\d{4}\/\d{2}\/\d{2}\//.test(new URL(page).pathname),
    }),
  ],
  vite: {
    plugins: [subsetAnimalIslandFonts()],
    // Waline is loaded on demand in the browser. Pre-bundle it during `astro dev`
    // so Vite can serve its optimized dependency module on the first visit.
    optimizeDeps: {
      include: ['@waline/client'],
    },
    resolve: {
      noExternal: ['animal-island-ui'],
    },
    ssr: {
      noExternal: ['animal-island-ui'],
    },
  },
  markdown: {
    processor: unified({ remarkPlugins: sharedRemarkPlugins }),
    shikiConfig: sharedShikiConfig,
  },
});
