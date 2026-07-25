/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_WALINE_SERVER_URL?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
