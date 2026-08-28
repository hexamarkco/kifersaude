/*
  # Busca de situacoes semelhantes ja atendidas (para o atendimento autonomo)

  A IA do chat de testes (/chat) e do atendimento autonomo usava so uma
  amostra generica/recente de mensagens outbound para aprender "estilo".
  Isso nao ajuda quando o lead traz uma situacao especifica (ex: "cotacao
  pra minha mae de 82 anos") — a IA precisa de exemplos REAIS de como
  situacoes parecidas foram atendidas antes, nao so o tom geral.

  Esta funcao usa o pg_trgm (ja habilitado) para achar mensagens inbound
  historicas textualmente parecidas com a mensagem atual do lead, e
  retorna, para cada uma, a resposta outbound real que a operacao deu
  logo em seguida — um par (situacao, resposta) de verdade, nao gerado.
*/

BEGIN;

CREATE OR REPLACE FUNCTION public.comm_whatsapp_find_similar_situations(
  p_query text,
  p_limit integer DEFAULT 4
)
RETURNS TABLE (situacao text, resposta text, similaridade real)
LANGUAGE sql
STABLE
AS $$
  WITH candidatos AS (
    SELECT
      m.id,
      m.chat_id,
      m.text_content,
      m.message_at,
      similarity(m.text_content, p_query) AS sim
    FROM public.comm_whatsapp_messages m
    WHERE m.direction = 'inbound'
      AND m.message_type = 'text'
      AND m.text_content IS NOT NULL
      AND length(m.text_content) BETWEEN 8 AND 600
      AND length(p_query) >= 8
      AND m.text_content % p_query
    ORDER BY sim DESC
    LIMIT GREATEST(p_limit, 1) * 4
  ),
  pareados AS (
    SELECT DISTINCT ON (c.chat_id)
      c.text_content AS situacao,
      c.sim,
      (
        SELECT o.text_content
        FROM public.comm_whatsapp_messages o
        WHERE o.chat_id = c.chat_id
          AND o.direction = 'outbound'
          AND o.message_type = 'text'
          AND o.text_content IS NOT NULL
          AND o.delivery_status <> 'failed'
          AND o.message_at > c.message_at
          AND o.message_at < c.message_at + interval '2 hours'
        ORDER BY o.message_at ASC
        LIMIT 1
      ) AS resposta
    FROM candidatos c
    ORDER BY c.chat_id, c.sim DESC
  )
  SELECT situacao, resposta, sim AS similaridade
  FROM pareados
  WHERE resposta IS NOT NULL
  ORDER BY sim DESC
  LIMIT GREATEST(p_limit, 1);
$$;

GRANT EXECUTE ON FUNCTION public.comm_whatsapp_find_similar_situations(text, integer) TO authenticated, service_role;

COMMIT;
