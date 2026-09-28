export const createClientRequestId = () => `client-request-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
