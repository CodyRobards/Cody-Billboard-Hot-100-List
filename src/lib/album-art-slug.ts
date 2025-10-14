const slugifyValue = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

export const generateAlbumArtSlug = (title: string, artist: string): string | null => {
  const normalizedTitle = title?.trim() ?? '';
  const normalizedArtist = artist?.trim() ?? '';
  const combined = [normalizedTitle, normalizedArtist].filter(Boolean).join(' ');

  if (!combined) {
    return null;
  }

  const slug = slugifyValue(combined);
  return slug || null;
};

export const generateAlbumArtSlugStrict = (title: string, artist: string): string => {
  return generateAlbumArtSlug(title, artist) ?? '';
};
