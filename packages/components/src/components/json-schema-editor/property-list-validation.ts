export function calculatePropertyValidationErrorCount(
  propertyNames: string[],
  childValidationCounts: Record<string, number>,
  hasRenameError: boolean,
): number {
  return (
    (hasRenameError ? 1 : 0) +
    propertyNames.reduce((total, key) => total + (childValidationCounts[key] ?? 0), 0)
  );
}
