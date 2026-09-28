export const resolveOAuthResource = (candidate: unknown, expectedResource: string): string | null => {
  const provided = typeof candidate === 'string' ? candidate.trim() : '';
  if (!provided) return expectedResource;
  return provided === expectedResource ? expectedResource : null;
};
