export function stripRootPreTabIndex(html: string): string {
  const openingPre = /^<pre\b[^>]*>/i.exec(html);
  if (openingPre === null) return html;
  return (
    openingPre[0].replace(/\s+tabindex=(?:"[^"]*"|'[^']*'|[^\s>]+)/i, '') +
    html.slice(openingPre[0].length)
  );
}
