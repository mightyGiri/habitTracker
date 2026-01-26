export function plural(count: number, singular: string, pluralForm?: string): string {
  const normalized = Number.isFinite(count) ? Math.abs(count) : 0;
  if (normalized === 1) {
    return singular;
  }
  return pluralForm ?? `${singular}s`;
}
