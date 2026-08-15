/*
  # Favoritar leads (estrela)

  Marcador simples pra destacar leads promissores. Sem tabela nova: só um
  booleano na própria leads, exibido como estrela ao lado do nome em toda
  tela que mostra o lead (Leads, Detalhes do Lead, Agenda, WhatsApp,
  Gerar Follow-up, Follow-ups em lote).
*/

BEGIN;

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS favorito boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.leads.favorito IS 'Lead marcado com estrela pelo usuário (favorito/promissor), puramente visual.';

COMMIT;
