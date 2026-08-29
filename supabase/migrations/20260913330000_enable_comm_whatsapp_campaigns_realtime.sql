/*
  # Realtime na campanha (tela de detalhe do disparo)

  A tela de detalhe (/painel/disparos/:id) so atualizava os numeros com o
  usuario clicando manualmente em "Atualizar". `comm_whatsapp_campaigns` e
  atualizada pelo worker uma vez por tick (a cada minuto, via
  recomputeCampaignCounters) enquanto a campanha esta ativa - poucas
  escritas, entao da pra assinar via Realtime sem risco de inundar o
  cliente.

  De proposito NAO habilita realtime em comm_whatsapp_campaign_targets: numa
  campanha grande (dezenas de milhares de alvos), essa tabela pode ter
  centenas/milhares de updates por minuto durante envio ativo - assinar
  linha a linha no navegador seria caro e desnecessario. A tela usa a
  atualizacao da linha da campanha como sinal de "algo mudou" e busca de
  novo os agregados leves (contadores via RPC, contagem de validacao
  pendente, pagina atual de contatos) a partir dai.
*/

ALTER TABLE public.comm_whatsapp_campaigns REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'comm_whatsapp_campaigns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.comm_whatsapp_campaigns;
  END IF;
END $$;
