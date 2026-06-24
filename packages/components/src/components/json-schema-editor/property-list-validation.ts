export function calculatePropertyValidationErrorCount(
  propertyNames: string[],
  childValidationCounts: Record<string, number>,
  hasRenameError: boolean,
): number {
  return (
    (hasRenameError ? 1 : 0) +
    Object.entries(childValidationCounts).reduce(
      (total, [key, count]) => total + (propertyNames.includes(key) ? count : 0),
      0,
    )
  );
}
