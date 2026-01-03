import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // 🌍 i18n 設定
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ja', 'es', 'fr', 'th', 'id', 'zh', 'de'],
    routing: {
      // デフォルト言語には /en を付けない
      prefixDefaultLocale: false,
    },
  },

  // sitemap は i18n と同じ階層
  integrations: [
    sitemap(),
  ],
});
