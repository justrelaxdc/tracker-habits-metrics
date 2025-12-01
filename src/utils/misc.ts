export function parseMaybeNumber(value: string): string | number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/).filter(word => word.length > 0).length;
}
