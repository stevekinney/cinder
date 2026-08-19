const RAW_TEXT_HTML_TAGS = new Set(['pre', 'script', 'style', 'textarea']);
const BLOCK_HTML_TAGS = new Set(
  'address article aside base basefont blockquote body caption center col colgroup dd details dialog dir div dl dt fieldset figcaption figure footer form frame frameset h1 h2 h3 h4 h5 h6 head header hr html iframe legend li link main menu menuitem nav noframes ol optgroup option p param search section summary table tbody td tfoot th thead title tr track ul'.split(
    ' ',
  ),
);

export function closesHtmlBlockWithTag(tag: string): boolean {
  return RAW_TEXT_HTML_TAGS.has(tag);
}

export function isInterruptingHtmlBlockTag(tag: string): boolean {
  return RAW_TEXT_HTML_TAGS.has(tag) || BLOCK_HTML_TAGS.has(tag);
}

export function isInterruptingHtmlBlockStart(value: string): boolean {
  if (/^(?:<!--|<\?|<![A-Z]|<!\[CDATA\[)/u.test(value)) return true;
  const tag = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?=[\s>/])/u.exec(value);
  return tag !== null && isInterruptingHtmlBlockTag(tag[1]!.toLowerCase());
}
