export const GITHUB_REPOSITORY_URL = 'https://github.com/stevekinney/cinder';
export const REPOSITORY_BLOB_URL = `${GITHUB_REPOSITORY_URL}/blob/main/`;

export function isRepositoryRelativeHref(href: string): boolean {
  return (
    href !== '' &&
    !href.startsWith('#') &&
    !href.startsWith('/') &&
    !/^[a-z][a-z0-9+.-]*:/i.test(href)
  );
}

export function repositorySourceHref(basePath: string, href: string): string {
  const [path = '', hash = ''] = href.split('#', 2);
  const baseUrl = `https://cinder.local/${basePath}${basePath === '' ? '' : '/'}`;
  const normalizedPath = new URL(path, baseUrl).pathname.replace(/^\/+/, '');
  return `${REPOSITORY_BLOB_URL}${normalizedPath}${hash === '' ? '' : `#${hash}`}`;
}

type ResolvedRenderedMarkdownLink =
  | string
  | {
      href: string;
      attributes?: string;
    };

export function rewriteRelativeRenderedMarkdownLinks(
  html: string,
  resolveHref: (href: string) => ResolvedRenderedMarkdownLink,
): string {
  return html.replace(
    /<a\b([^>]*?)\shref="([^"]+)"([^>]*)>/gi,
    (match: string, before: string, href: string, after: string) => {
      if (!isRepositoryRelativeHref(href)) return match;
      const resolved = resolveHref(href);
      if (typeof resolved === 'string') {
        return `<a${before} href="${resolved}"${after}>`;
      }
      return `<a${before} href="${resolved.href}"${resolved.attributes ?? ''}${after}>`;
    },
  );
}
