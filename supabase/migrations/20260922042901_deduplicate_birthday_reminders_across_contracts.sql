-- Birthday identity is the person and year, never the contract.
-- Deduplicate the INSERT source before ON CONFLICT: otherwise two contracts for
-- the same person cause PostgreSQL to update the same row twice in one command.
-- Keep the existing unique index and preserve completion state on regeneration.
CREATE OR REPLACE FUNCTION public.generate_birthdays_for_year(target_year int)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF target_year IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO reminders (
    contract_id,
    lead_id,
    tipo,
    titulo,
    descricao,
    data_lembrete,
    lido,
    prioridade,
    pessoa_tipo,
    pessoa_id,
    pessoa_chave,
    ano
  )
  SELECT DISTINCT ON (public.build_holder_pessoa_chave(holder.cpf))
    c.id,
    c.lead_id,
    'Aniversário',
    'Aniversário de ' || holder.nome_completo,
    'Enviar parabéns ao titular ' || holder.nome_completo || '.',
    (public.safe_make_date(target_year, EXTRACT(MONTH FROM holder.data_nascimento)::int, EXTRACT(DAY FROM holder.data_nascimento)::int)
      + time '09:00')::timestamptz,
    false,
    'normal',
    'titular',
    holder.id,
    public.build_holder_pessoa_chave(holder.cpf),
    target_year
  FROM contract_holders holder
  JOIN contracts c ON c.id = holder.contract_id
  WHERE holder.data_nascimento IS NOT NULL
    AND public.build_holder_pessoa_chave(holder.cpf) IS NOT NULL
  ORDER BY public.build_holder_pessoa_chave(holder.cpf),
    c.created_at DESC NULLS LAST, holder.created_at DESC NULLS LAST, holder.id DESC
  ON CONFLICT (pessoa_tipo, pessoa_chave, ano) WHERE tipo = 'Aniversário'
  DO UPDATE SET
    contract_id = EXCLUDED.contract_id,
    lead_id = EXCLUDED.lead_id,
    titulo = EXCLUDED.titulo,
    descricao = EXCLUDED.descricao,
    data_lembrete = EXCLUDED.data_lembrete,
    pessoa_id = EXCLUDED.pessoa_id;

  INSERT INTO reminders (
    contract_id,
    lead_id,
    tipo,
    titulo,
    descricao,
    data_lembrete,
    lido,
    prioridade,
    pessoa_tipo,
    pessoa_id,
    pessoa_chave,
    ano
  )
  SELECT DISTINCT ON (public.build_dependent_pessoa_chave(dependent.cpf, dependent.nome_completo, dependent.data_nascimento))
    c.id,
    c.lead_id,
    'Aniversário',
    'Aniversário de ' || dependent.nome_completo,
    'Enviar parabéns ao dependente ' || dependent.nome_completo ||
      CASE
        WHEN holder.nome_completo IS NOT NULL THEN ' (titular: ' || holder.nome_completo || ').'
        ELSE '.'
      END,
    (public.safe_make_date(target_year, EXTRACT(MONTH FROM dependent.data_nascimento)::int, EXTRACT(DAY FROM dependent.data_nascimento)::int)
      + time '09:00')::timestamptz,
    false,
    'normal',
    'dependente',
    dependent.id,
    public.build_dependent_pessoa_chave(dependent.cpf, dependent.nome_completo, dependent.data_nascimento),
    target_year
  FROM dependents dependent
  LEFT JOIN contract_holders holder ON holder.id = dependent.holder_id
  JOIN contracts c ON c.id = dependent.contract_id
  WHERE dependent.data_nascimento IS NOT NULL
    AND public.build_dependent_pessoa_chave(dependent.cpf, dependent.nome_completo, dependent.data_nascimento) IS NOT NULL
  ORDER BY public.build_dependent_pessoa_chave(dependent.cpf, dependent.nome_completo, dependent.data_nascimento),
    c.created_at DESC NULLS LAST, dependent.created_at DESC NULLS LAST, dependent.id DESC
  ON CONFLICT (pessoa_tipo, pessoa_chave, ano) WHERE tipo = 'Aniversário'
  DO UPDATE SET
    contract_id = EXCLUDED.contract_id,
    lead_id = EXCLUDED.lead_id,
    titulo = EXCLUDED.titulo,
    descricao = EXCLUDED.descricao,
    data_lembrete = EXCLUDED.data_lembrete,
    pessoa_id = EXCLUDED.pessoa_id;

  DELETE FROM reminders r
  WHERE r.tipo = 'Aniversário'
    AND r.ano = target_year
    AND r.pessoa_tipo = 'titular'
    AND NOT EXISTS (
      SELECT 1
      FROM contract_holders h
      WHERE public.build_holder_pessoa_chave(h.cpf) = r.pessoa_chave
    );

  DELETE FROM reminders r
  WHERE r.tipo = 'Aniversário'
    AND r.ano = target_year
    AND r.pessoa_tipo = 'dependente'
    AND NOT EXISTS (
      SELECT 1
      FROM dependents d
      WHERE public.build_dependent_pessoa_chave(d.cpf, d.nome_completo, d.data_nascimento) = r.pessoa_chave
    );
END;
$$;

