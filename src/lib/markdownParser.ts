// src/lib/markdownParser.ts

import { marked } from 'marked';

type HeadingTokenLike =
  | { type?: string; depth?: number; text?: string; raw?: string }
  | string;

type RendererHeadingArgs =
  | [token: HeadingTokenLike]
  | [text: string, level: number, raw?: string, slugger?: any];

/**
 * 見出し用のslug生成（日本語/英語混在対応）
 * - 記号を落としてハイフン区切り
 * - 長すぎるIDを制限
 * - 同一slugが複数回出た場合は -2, -3 ... を付けて重複回避
 */
function createSlugFactory() {
  const seen = new Map<string, number>();

  return (text: string): string => {
    const base = (text ?? '')
      .toString()
      .trim()
      .toLowerCase()
      // 英数/_/空白/日本語（ひら/カナ/漢字）/ハイフン以外を除去
      .replace(/[^\w\s\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    const slug = base || 'section';

    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);

    // 1回目はそのまま、2回目以降は -2, -3...
    return count === 0 ? slug : `${slug}-${count + 1}`;
  };
}

/**
 * marked renderer（見出しにidを付与）
 * - markedのバージョン差（token形式 / 旧シグネチャ）を吸収
 */
function createRenderer() {
  const renderer = new marked.Renderer();
  const slugify = createSlugFactory();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (renderer as any).heading = (...args: RendererHeadingArgs) => {
    // token形式: heading(token)
    if (args.length === 1 && typeof args[0] === 'object') {
      const token = args[0] as any;
      const level = Number(token.depth ?? 2);
      const text = String(token.text ?? '');
      const id = slugify(text);
      return `<h${level} id="${id}">${text}</h${level}>`;
    }

    // 旧形式: heading(text, level, raw, slugger)
    const [text, level] = args as unknown as [string, number];
    const safeLevel = Number(level ?? 2);
    const safeText = String(text ?? '');
    const id = slugify(safeText);
    return `<h${safeLevel} id="${id}">${safeText}</h${safeLevel}>`;
  };

  return renderer;
}

// setOptionsは1回でまとめる（上書き事故を避ける）
marked.setOptions({
  breaks: true,
  gfm: true,
  renderer: createRenderer(),
});

/**
 * Markdown → HTML 変換
 *
 * セキュリティ:
 * - Phase 5: 信頼された入力のみ（Strapi管理画面）
 * - Phase 7以降: 外部入力・共同編集を想定してDOMPurifyでサニタイズ追加
 */
export function parseMarkdown(markdown: string): string {
  if (!markdown) return '';
  try {
    // marked() / marked.parse() の差異吸収
    const html = (marked.parse ? marked.parse(markdown) : marked(markdown)) as unknown as string;

    // Phase 7以降で追加:
    // import DOMPurify from 'dompurify';
    // return DOMPurify.sanitize(html);

    return html;
  } catch (error) {
    console.error('Markdown parse error:', error);
    return markdown;
  }
}

export interface Heading {
  level: number;
  text: string;
  id: string;
}

/**
 * Markdownから見出しを抽出（h1-h3）
 * - rendererと同じslug生成ロジックを使い、TOCアンカーずれを防ぐ
 * - 同一見出しの重複も -2, -3... で回避
 */
export function extractHeadings(markdown: string): Heading[] {
  if (!markdown) return [];

  // ^## のような見出し（h1-h3）のみ
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  const headings: Heading[] = [];
  const slugify = createSlugFactory();

  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(markdown)) !== null) {
    const level = match[1].length;

    // 表示用textだけ軽く整形（アンカーはslugifyが決めるので崩れにくい）
    const rawText = match[2].trim();
    const text = rawText
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // link
      .replace(/`(.+?)`/g, '$1')          // inline code
      .replace(/\*\*(.+?)\*\*/g, '$1')    // bold
      .replace(/\*(.+?)\*/g, '$1')        // italic
      .replace(/<[^>]*>/g, '')            // html tag
      .trim();

    const id = slugify(text);

    headings.push({ level, text, id });
  }

  return headings;
}

/**
 * 読了時間を計算（日本語・英語対応）
 */
export function calculateReadingTime(content: string, locale: string = 'en'): number {
  if (!content) return 0;

  if (locale === 'ja') {
    const chars = content.replace(/\s+/g, '').length;
    return Math.ceil(chars / 400);
  }

  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / 200);
}

/**
 * 抜粋生成（Markdownをざっくりプレーンテキスト化）
 */
export function generateExcerpt(content: string, maxLength = 160): string {
  if (!content) return '';

  const plainText = content
    .replace(/#+\s/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/\[(.+?)\]\(.+?\)/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (plainText.length <= maxLength) return plainText;
  return plainText.slice(0, maxLength).trimEnd() + '...';
}
