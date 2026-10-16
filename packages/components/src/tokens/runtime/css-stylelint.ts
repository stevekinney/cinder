const STYLELINT_STATUS_COLOR_MIX_PATTERN =
  /color-mix\([\s\S]*?var\(\s*--cinder-(?:info|success|warning|danger)\s*(?:[,)])/;

export function stylelintDisableCommentFor(value: string): string | undefined {
  if (!STYLELINT_STATUS_COLOR_MIX_PATTERN.test(value)) return undefined;
  return (
    '/* stylelint-disable-next-line declaration-property-value-disallowed-list -- ' +
    'canonical status-mixing formula, the intentional shared contract; component CSS ' +
    'must still use the named tier instead of recreating it. */'
  );
}

export function sanitizeComment(description: string): string {
  return description.replaceAll('*/', '*\\/').replaceAll(/\s+/g, ' ').trim();
}
