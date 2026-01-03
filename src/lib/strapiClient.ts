// src/lib/strapiClient.ts

const STRAPI_URL = (import.meta.env.PUBLIC_STRAPI_URL ?? 'http://localhost:1337').replace(/\/$/, '');

interface StrapiResponse<T> {
  data: T;
  meta?: any;
}

interface StrapiEntity {
  id: number;
  attributes?: any;
}

/**
 * Strapi v5レスポンスを正規化
 * - Entity: { id, attributes: {...} } → { id, ...attributes }
 * - Relation: { data: {...} | [...] | null } → 正規化して代入 / null
 */
function normalize(entity: any): any {
  if (!entity) return null;

  // Strapi entity shape: { id, attributes }
  if (typeof entity === 'object' && 'id' in entity && 'attributes' in entity) {
    const { id, attributes } = entity as StrapiEntity;
    const normalized: any = { id, ...(attributes ?? {}) };

    // Relation / Media / nested data を再帰で潰す
    for (const key of Object.keys(normalized)) {
      const value = normalized[key];

      if (value && typeof value === 'object' && 'data' in value) {
        const rel = value.data;

        if (rel === null) {
          normalized[key] = null;
        } else if (Array.isArray(rel)) {
          normalized[key] = rel.map(normalize);
        } else {
          normalized[key] = normalize(rel);
        }
      }
    }

    return normalized;
  }

  // Already normalized or component/dynamic-zone object — keep as-is
  return entity;
}

/**
 * Strapiレスポンスを正規化（配列/単体の両対応）
 */
function normalizeResponse<T extends StrapiEntity | StrapiEntity[]>(
  response: StrapiResponse<T>
): StrapiResponse<any> {
  const data: any = response?.data;

  return {
    data: Array.isArray(data) ? data.map(normalize) : normalize(data),
    meta: response?.meta,
  };
}

/**
 * 記事一覧取得
 */
export async function fetchArticles(
  locale = 'en',
  filters: Record<string, any> = {},
  sort = 'publishedAt:desc',
  pageSize = 50
): Promise<StrapiResponse<any[]>> {
  const params = new URLSearchParams({
    locale,
    sort,
  });

  // pagination（増えても取りこぼさない）
  params.append('pagination[pageSize]', String(pageSize));

  // populate明示（必要最小限）
  params.append('populate[coverImage]', 'true');
  params.append('populate[heroImage]', 'true');
  params.append('populate[category]', 'true');

  // フィルタをネスト形式で構築
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    if (key === 'category.slug') {
      params.append('filters[category][slug][$eq]', String(value));
      return;
    }

    if (typeof value === 'boolean') {
      params.append(`filters[${key}][$eq]`, value ? 'true' : 'false');
      return;
    }

    params.append(`filters[${key}][$eq]`, String(value));
  });

  try {
    const res = await fetch(`${STRAPI_URL}/api/articles?${params.toString()}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);

    const json = (await res.json()) as StrapiResponse<any>;
    const normalized = normalizeResponse(json);

    // 返却型を配列に寄せる（安全策）
    const dataArray = Array.isArray(normalized.data)
      ? normalized.data
      : normalized.data
        ? [normalized.data]
        : [];

    return { data: dataArray, meta: normalized.meta };
  } catch (error) {
    console.error('Failed to fetch articles:', error);
    return { data: [], meta: {} };
  }
}

/**
 * 単一記事取得（slug一致の先頭1件）
 * ※ Strapiの /api/articles?filters[slug][$eq]=... は配列で返る想定
 */
export async function fetchArticle(slug: string, locale = 'en'): Promise<any | null> {
  const params = new URLSearchParams({
    locale,
  });

  params.append('filters[slug][$eq]', slug);

  // populate明示（必要最小限）
  params.append('populate[coverImage]', 'true');
  params.append('populate[heroImage]', 'true');
  params.append('populate[category]', 'true');

  // slug一致のうち1件だけ
  params.append('pagination[pageSize]', '1');

  try {
    const res = await fetch(`${STRAPI_URL}/api/articles?${params.toString()}`);
    if (!res.ok) throw new Error(`Article not found: ${res.status}`);

    const json = (await res.json()) as StrapiResponse<any>;
    const normalized = normalizeResponse(json);

    const items = Array.isArray(normalized.data)
      ? normalized.data
      : normalized.data
        ? [normalized.data]
        : [];

    return items[0] ?? null;
  } catch (error) {
    console.error('Failed to fetch article:', error);
    return null;
  }
}

/**
 * 単一記事取得（slug）: alias
 */
export async function fetchArticleBySlug(slug: string, locale = 'en') {
  return fetchArticle(slug, locale);
}

export async function fetchEditorialPicks(locale = 'en') {
  return fetchArticles(locale, { editorialPick: true });
}

export async function fetchFeaturedArticles(locale = 'en') {
  return fetchArticles(locale, { featured: true });
}

export async function fetchDeepDiveArticles(locale = 'en') {
  return fetchArticles(locale, { deepDive: true });
}

/**
 * Category Glimpses取得
 * featured記事がない場合は最新2件をフォールバック
 */
export async function fetchCategoryGlimpses(locale = 'en') {
  const categories = ['culture', 'language', 'food', 'society', 'art', 'travel'];

  const glimpses = await Promise.all(
    categories.map(async (categorySlug) => {
      // featured記事を優先
      let articlesData = await fetchArticles(
        locale,
        { 'category.slug': categorySlug, featured: true },
        'publishedAt:desc',
        10
      );

      // featuredがなければ最新を取得
      if (articlesData.data.length === 0) {
        articlesData = await fetchArticles(
          locale,
          { 'category.slug': categorySlug },
          'publishedAt:desc',
          10
        );
      }

      return {
        category: categorySlug,
        articles: articlesData.data.slice(0, 2),
      };
    })
  );

  return glimpses;
}

/**
 * カテゴリ一覧取得
 * ※Categoryの中でrelationが必要になったらpopulate追加
 */
export async function fetchCategories(locale = 'en') {
  const params = new URLSearchParams({
    locale,
    sort: 'order:asc',
  });

  // 取りこぼし防止
  params.append('pagination[pageSize]', '100');

  try {
    const res = await fetch(`${STRAPI_URL}/api/categories?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch categories');

    const json = (await res.json()) as StrapiResponse<any>;
    const normalized = normalizeResponse(json);

    const items = Array.isArray(normalized.data)
      ? normalized.data
      : normalized.data
        ? [normalized.data]
        : [];

    return { data: items, meta: normalized.meta };
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return { data: [] as any[] };
  }
}

export async function fetchArticlesByCategory(categorySlug: string, locale = 'en') {
  return fetchArticles(locale, { 'category.slug': categorySlug });
}

export function getStrapiImageUrl(path?: string, fallback = '/images/placeholder.jpg'): string {
  if (!path) return fallback;
  if (path.startsWith('http')) return path;
  return `${STRAPI_URL}${path}`;
}

/**
 * 画像URL取得（normalize漏れがあっても壊れにくい保険込み）
 */
export function getArticleImageUrl(article: any): string {
  const coverUrl =
    article?.coverImage?.url ??
    article?.coverImage?.attributes?.url ??
    article?.attributes?.coverImage?.data?.attributes?.url;

  const heroUrl =
    article?.heroImage?.url ??
    article?.heroImage?.attributes?.url ??
    article?.attributes?.heroImage?.data?.attributes?.url;

  return getStrapiImageUrl(coverUrl || heroUrl);
}
