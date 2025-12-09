const collapseWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim();

export const normalizeSentenceCase = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;

  const cleaned = collapseWhitespace(value);
  if (!cleaned) return null;

  const lowerCased = cleaned.toLowerCase();
  return lowerCased.charAt(0).toUpperCase() + lowerCased.slice(1);
};

export const normalizeTitleCase = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) return null;

  const cleaned = collapseWhitespace(value);
  if (!cleaned) return null;

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map(part => {
      const lower = part.toLowerCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
};
