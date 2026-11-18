/** Shared V2-facing types. Historical V1 database rows remain readable, not executable. */
export type HandoffCode = 'QUALIFICACAO_COMPLETA' | 'RECUSOU_COTACAO' | 'PRECISA_HUMANO';
export type AutonomousMessageRow = { role: 'lead' | 'ai'; content: string };
