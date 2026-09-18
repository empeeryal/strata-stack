import type {
  BlogPosting,
  BreadcrumbList,
  Organization,
  TechArticle,
  WebSite,
  WithContext,
} from 'schema-dts';

import { siteConfig } from '@/site.config';

/** Any JSON-LD node we emit. */
export type JsonLd = WithContext<
  WebSite | Organization | BreadcrumbList | BlogPosting | TechArticle
>;

/** `<title>` text: "Page · Site" or the site tagline for the home page. */
export function pageTitle(title?: string): string {
  return title ? `${title} · ${siteConfig.name}` : `${siteConfig.name} – ${siteConfig.tagline}`;
}

/** Absolute URL for a site-relative path. */
export function absolute(path: string, site: URL | string): string {
  return new URL(path, site).toString();
}

/** Serialize JSON-LD safely for inclusion in a <script> tag. */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

export function websiteJsonLd(site: URL | string): WithContext<WebSite> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.name,
    description: siteConfig.description,
    url: absolute('/', site),
    inLanguage: siteConfig.locale,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${absolute('/search', site)}?q={search_term_string}`,
      },
      // schema-dts does not model the `query-input` property.
      ...({ 'query-input': 'required name=search_term_string' } as object),
    },
  };
}

export function organizationJsonLd(site: URL | string): WithContext<Organization> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.name,
    url: absolute('/', site),
    logo: absolute('/icon-512.png', site),
    sameAs: Object.values(siteConfig.social),
  };
}

export interface BreadcrumbItem {
  name: string;
  /** Site-relative or absolute URL. Omit for the current page. */
  url?: string;
}

export function breadcrumbsJsonLd(
  items: BreadcrumbItem[],
  site: URL | string,
): WithContext<BreadcrumbList> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      ...(item.url ? { item: absolute(item.url, site) } : {}),
    })),
  };
}

export interface ArticleJsonLdInput {
  url: string;
  title: string;
  description: string;
  image: string;
  /** Omitted when the source has no reliable date (better than a made-up one). */
  datePublished?: Date;
  dateModified?: Date;
  author: { name: string; url?: string };
  tags?: readonly string[];
  site: URL | string;
}

export function blogPostingJsonLd(input: ArticleJsonLdInput): WithContext<BlogPosting> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    ...articleFields(input),
  };
}

export function techArticleJsonLd(input: ArticleJsonLdInput): WithContext<TechArticle> {
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    ...articleFields(input),
  };
}

function articleFields(input: ArticleJsonLdInput) {
  return {
    headline: input.title,
    description: input.description,
    image: absolute(input.image, input.site),
    url: absolute(input.url, input.site),
    mainEntityOfPage: absolute(input.url, input.site),
    ...(input.datePublished ? { datePublished: input.datePublished.toISOString() } : {}),
    ...((input.dateModified ?? input.datePublished)
      ? { dateModified: (input.dateModified ?? input.datePublished)!.toISOString() }
      : {}),
    inLanguage: siteConfig.locale,
    ...(input.tags && input.tags.length > 0 ? { keywords: input.tags.join(', ') } : {}),
    author: {
      '@type': 'Person' as const,
      name: input.author.name,
      ...(input.author.url ? { url: input.author.url } : {}),
    },
    publisher: {
      '@type': 'Organization' as const,
      name: siteConfig.name,
      logo: {
        '@type': 'ImageObject' as const,
        url: absolute('/icon-512.png', input.site),
      },
    },
  };
}
