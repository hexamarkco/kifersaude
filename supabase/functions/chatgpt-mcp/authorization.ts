export const mcpAdminAuthorizationError = (actorId: string | null) => actorId
  ? null
  : { success: false, error_code: 'UNAUTHORIZED', message: 'Esta consulta exige uma conexão OAuth de administrador.' } as const;

export const mcpWriteAuthorizationError = (actorId: string | null) => actorId
  ? null
  : { success: false, error_code: 'UNAUTHORIZED', message: 'Ações de escrita exigem uma conexão OAuth de administrador.' } as const;
