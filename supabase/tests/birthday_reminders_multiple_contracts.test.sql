-- Run only against an isolated test database; fixtures are rolled back.
BEGIN;
SET LOCAL search_path = extensions, public, pg_catalog;
SELECT plan(1);
DO $$
DECLARE
  lead uuid := gen_random_uuid();
  old_contract uuid := gen_random_uuid();
  new_contract uuid := gen_random_uuid();
  other_contract uuid := gen_random_uuid();
  old_holder uuid := gen_random_uuid();
  new_holder uuid := gen_random_uuid();
  other_holder uuid := gen_random_uuid();
  current_year int := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  reminder uuid;
BEGIN
  INSERT INTO public.leads (id, nome_completo, telefone, origem, tipo_contratacao, responsavel, skip_automation)
  VALUES (lead, 'Birthday regression', '00000000000', 'Teste', 'Pessoa Física', 'Nick', true);

  INSERT INTO public.contracts (id, lead_id, codigo_contrato, modalidade, operadora, produto_plano, responsavel, created_at)
  VALUES
    (old_contract, lead, old_contract::text, 'PF', 'Teste', 'Teste', 'Nick', '2025-01-01'),
    (new_contract, lead, new_contract::text, 'PF', 'Teste', 'Teste', 'Nick', '2026-01-01'),
    (other_contract, lead, other_contract::text, 'PF', 'Teste', 'Teste', 'Nick', '2024-01-01');

  INSERT INTO public.contract_holders (id, contract_id, nome_completo, cpf, data_nascimento, telefone)
  VALUES
    (old_holder, old_contract, 'Birthday holder', '900.000.000-01', '1980-09-22', '00000000000'),
    (new_holder, new_contract, 'Birthday holder updated', '90000000001', '1980-09-22', '00000000000'),
    (other_holder, other_contract, 'Birthday holder', '90000000002', '1980-09-22', '00000000000');

  IF (SELECT count(*) FROM public.reminders WHERE lead_id = lead AND tipo = 'Aniversário') <> 2 THEN
    RAISE EXCEPTION 'Holder triggers must create one reminder per person, not per contract or lead';
  END IF;

  INSERT INTO public.dependents (contract_id, holder_id, nome_completo, data_nascimento, relacao)
  VALUES
    (old_contract, old_holder, '  Birthday   dependent  ', '2012-02-29', 'Filho(a)'),
    (new_contract, new_holder, 'birthday dependent', '2012-02-29', 'Filho(a)'),
    (new_contract, new_holder, 'birthday sibling', '2012-02-29', 'Filho(a)');

  SELECT id INTO reminder FROM public.reminders
  WHERE pessoa_tipo = 'titular' AND pessoa_chave = 'cpf:90000000001' AND ano = current_year;
  UPDATE public.reminders SET lido = true, concluido_em = now() WHERE id = reminder;

  -- Previously this raised: ON CONFLICT DO UPDATE command cannot affect row a second time.
  PERFORM public.generate_birthdays_for_year(current_year);
  PERFORM public.generate_birthdays_for_year(current_year);

  IF (SELECT count(*) FROM public.reminders WHERE lead_id = lead AND tipo = 'Aniversário' AND ano = current_year) <> 4 THEN
    RAISE EXCEPTION 'Yearly generation must preserve both holders and both dependents exactly once';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.reminders WHERE id = reminder AND lido AND concluido_em IS NOT NULL
      AND contract_id = new_contract AND pessoa_id = new_holder AND titulo = 'Aniversário de Birthday holder updated'
  ) THEN
    RAISE EXCEPTION 'Regeneration must keep completion, identity and the latest contract/person consistent';
  END IF;

  PERFORM public.generate_birthdays_for_year(2031);
  PERFORM public.generate_birthdays_for_year(NULL);
  IF (SELECT count(*) FROM public.reminders WHERE lead_id = lead AND tipo = 'Aniversário' AND ano = 2031) <> 4 THEN
    RAISE EXCEPTION 'Different years must have their own reminders';
  END IF;
  IF (SELECT count(*) FROM public.reminders WHERE lead_id = lead AND pessoa_tipo = 'dependente'
      AND ano = 2031 AND data_lembrete::date = date '2031-02-28') <> 2 THEN
    RAISE EXCEPTION 'Leap-day birthdays must still use February 28 in a non-leap year';
  END IF;
END;
$$;
SELECT pass('Birthdays are unique across contracts and annual generation preserves completion and individual dependents');
SELECT * FROM finish();
ROLLBACK;
