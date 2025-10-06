const DEFAULT_EXCERPT_LIMIT = 240;

export function clampExcerpt(
  value: string | undefined | null,
  limit = DEFAULT_EXCERPT_LIMIT
): string {
  if (!value) {
    return '';
  }

  const normalized = value.trim();
  if (normalized.length <= limit) {
    return normalized;
  }

  const truncated = normalized.slice(0, limit - 1).trimEnd();
  return `${truncated}…`;
}
