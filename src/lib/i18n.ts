// src/lib/i18n.ts

export const locales = ['en', 'ja', 'es', 'fr', 'th', 'id', 'zh', 'de'] as const;
export type Locale = typeof locales[number];
export const defaultLocale: Locale = 'en';

/**
 * UI テキストの多言語対応
 *
 * 戦略:
 * - en/jaは完全翻訳（jaは型でキー漏れを検知）
 * - 他言語はenをコピーして初期化（翻訳漏れでもUI崩れなし）
 * - 翻訳が進むほど上書き
 */
const uiBase = {
  'site.title': 'Genryu Japan',
  'site.subtitle': 'A quiet interface to deep Japanese context',
  'site.tagline': 'The Origin of Flow',
  'nav.home': 'Home',
  'nav.culture': 'Culture',
  'nav.language': 'Language',
  'nav.food': 'Food',
  'nav.society': 'Society',
  'nav.art': 'Art',
  'nav.travel': 'Travel',
  'nav.about': 'About',
  'home.editorialPicks': 'Editorial Picks',
  'home.categoryGlimpses': 'Explore by Category',
  'home.deepDive': 'Deep Dive',
  'home.deepDiveDesc': 'Long-form essays on Japanese culture, edited from a personal perspective.',
  'home.aboutTeaser': 'About Genryu Japan',
  'home.aboutTeaserText': 'Zen, Gen, Zine are not categories, but perspectives.',
  'home.more': 'More',
  'home.comingSoon': 'Coming soon...',
  'home.learnMore': 'Learn more',
  'article.readMore': 'Read more',
  'article.readTime': 'min read',
  'article.publishedOn': 'Published on',
  'footer.philosophy': 'Zen / Gen / Zine',
  'footer.tagline': 'Exploring Japan through context, not clichés.',
  'footer.navigate': 'Navigate',
  'footer.connect': 'Connect',
  'footer.copyright': 'All rights reserved',
  'footer.privacy': 'Privacy',
} as const;

export type UiKey = keyof typeof uiBase;

/**
 * jaは satisfies で uiBase のキー網羅を型で保証
 */
const uiJa = {
  'site.title': '源流ジャパン',
  'site.subtitle': '深い日本の文脈への静かなインターフェース',
  'site.tagline': 'The Origin of Flow',
  'nav.home': 'ホーム',
  'nav.culture': '文化',
  'nav.language': '言語',
  'nav.food': '食',
  'nav.society': '社会',
  'nav.art': 'アート',
  'nav.travel': '旅',
  'nav.about': 'について',
  'home.editorialPicks': '編集部のおすすめ',
  'home.categoryGlimpses': 'カテゴリから探す',
  'home.deepDive': 'Deep Dive',
  'home.deepDiveDesc': '日本文化についての長文エッセイ、個人的視点から編集',
  'home.aboutTeaser': '源流ジャパンについて',
  'home.aboutTeaserText': 'Zen、Gen、Zineはカテゴリではなく、視点です。',
  'home.more': 'もっと見る',
  'home.comingSoon': '準備中...',
  'home.learnMore': 'もっと知る',
  'article.readMore': '続きを読む',
  'article.readTime': '分',
  'article.publishedOn': '公開日',
  'footer.philosophy': 'Zen / Gen / Zine',
  'footer.tagline': '日本を文脈から探る、クリシェではなく',
  'footer.navigate': 'ナビゲーション',
  'footer.connect': 'つながる',
  'footer.copyright': 'All rights reserved',
  'footer.privacy': 'プライバシー',
} satisfies typeof uiBase;

export const ui = {
  en: uiBase,
  ja: uiJa,
  // 他言語は英語コピーで初期化（翻訳漏れ防止）
  es: { ...uiBase },
  fr: { ...uiBase },
  th: { ...uiBase },
  id: { ...uiBase },
  zh: { ...uiBase },
  de: { ...uiBase },
} as const;

export function t(locale: Locale, key: UiKey): string {
  return ui[locale]?.[key] ?? ui[defaultLocale][key];
}

/**
 * "YYYY-MM-DD" だけの文字列がUTC解釈されて前日表示になる事故を回避
 */
function parseDateInput(date: string | Date): Date {
  if (date instanceof Date) return date;
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return new Date(`${date}T00:00:00`);
  return new Date(date);
}

export function formatDate(date: string | Date, locale: Locale): string {
  const d = parseDateInput(date);

  const localeMap: Record<Locale, string> = {
    en: 'en-US',
    ja: 'ja-JP',
    es: 'es-ES',
    fr: 'fr-FR',
    th: 'th-TH',
    id: 'id-ID',
    zh: 'zh-CN',
    de: 'de-DE',
  };

  return d.toLocaleDateString(localeMap[locale], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function isValidLocale(locale: string): locale is Locale {
  return (locales as readonly string[]).includes(locale);
}

export function getLocaleFromUrl(url: URL): Locale {
  const segments = url.pathname.split('/').filter(Boolean);
  const potentialLocale = segments[0];
  return isValidLocale(potentialLocale) ? potentialLocale : defaultLocale;
}
