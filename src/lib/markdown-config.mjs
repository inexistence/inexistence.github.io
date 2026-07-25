import responsiveImages from '../plugins/responsive-images.mjs';

// Keep article bodies and category excerpts on the exact same Markdown path.
export const sharedRemarkPlugins = [responsiveImages];

/** @type {import('@astrojs/markdown-remark').ShikiConfig} */
export const sharedShikiConfig = {
  theme: 'github-light',
  wrap: true,
};
