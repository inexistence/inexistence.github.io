/// <reference types="astro/client" />

declare module 'animal-island-ui/style';
declare module '@waline/client/style';

interface ImportMetaEnv {
  readonly PUBLIC_WALINE_SERVER_URL?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
