export const getBearerToken = (authHeader: string | null): string | null => {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
};

export const isServiceRoleRequest = (req: Request, serviceRoleKey: string): boolean => {
  const expected = serviceRoleKey.trim();
  if (!expected) return false;
  const bearerToken = getBearerToken(req.headers.get('Authorization'));
  if (bearerToken && bearerToken === expected) return true;
  const apikey = req.headers.get('apikey')?.trim() || req.headers.get('x-api-key')?.trim() || '';
  return apikey === expected;
};
