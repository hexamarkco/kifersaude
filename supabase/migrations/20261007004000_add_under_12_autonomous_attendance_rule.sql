/*
  # Add the under-12 eligibility rule to Autonomous Reply

  A child under 12 cannot be quoted alone by Kifer's partner operators. The
  attendant must state the fixed eligibility rule before collecting further
  qualification data, rather than presenting a nonexistent carrier-specific
  exception.

  Create a new active version from the current Autonomous Reply configuration
  so the operation's prompt, model override, and generation settings remain
  intact and reversible in the AI configuration history.
*/

DO $$
DECLARE
  v_feature_id uuid;
  v_current public.ai_feature_configs%ROWTYPE;
  v_next_version integer;
BEGIN
  SELECT id
    INTO v_feature_id
    FROM public.ai_features
   WHERE key = 'autonomous.reply';

  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'Feature autonomous.reply was not found.';
  END IF;

  SELECT *
    INTO v_current
    FROM public.ai_feature_configs
   WHERE feature_id = v_feature_id
     AND is_active = true
   ORDER BY version DESC
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Feature autonomous.reply has no active configuration.';
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1
    INTO v_next_version
    FROM public.ai_feature_configs
   WHERE feature_id = v_feature_id;

  UPDATE public.ai_feature_configs
     SET is_active = false
   WHERE feature_id = v_feature_id
     AND is_active = true;

  INSERT INTO public.ai_feature_configs (
    feature_id,
    version,
    is_active,
    provider,
    model,
    fallback_model,
    temperature,
    max_output_tokens,
    reasoning_effort,
    timeout_ms,
    retry_count,
    use_global_instructions,
    use_global_style,
    feature_prompt,
    output_instructions,
    context_config_json,
    created_by,
    model_override_enabled
  ) VALUES (
    v_feature_id,
    v_next_version,
    true,
    v_current.provider,
    v_current.model,
    v_current.fallback_model,
    v_current.temperature,
    v_current.max_output_tokens,
    v_current.reasoning_effort,
    v_current.timeout_ms,
    v_current.retry_count,
    v_current.use_global_instructions,
    v_current.use_global_style,
    concat_ws(E'\n\n', NULLIF(btrim(v_current.feature_prompt), ''), $rule$
REGRA COMERCIAL FIXA — CRIANÇA MENOR DE 12 ANOS

Quando o beneficiário tiver menos de 12 anos, explique com clareza antes de pedir qualquer outro dado: não trabalhamos com operadoras que aceitem criança menor de 12 anos como titular sozinha.

Para cotar, um adulto precisa entrar no plano como titular e a criança entra como dependente. Os dois são beneficiários e há mensalidade para o adulto e para a criança. O adulto não pode ficar apenas como responsável ou assinante fora do plano, e não é possível cotar somente a criança nesse caso.

NUNCA trate essa regra como algo a confirmar depois, como exceção de alguma operadora ou como possibilidade de cotar só a criança. Não diga que o adulto “não precisa usar o plano” e não prometa verificar uma alternativa inexistente. Primeiro responda a dúvida do cliente de forma direta; somente se ele confirmar que um adulto pode entrar junto, siga para a idade desse adulto e a qualificação normal. Se não aceitar essa composição, acolha a decisão e encerre o assunto sem insistir em idade, cidade, CNPJ/MEI ou outros dados.

ENCERRAMENTO PARA COTAÇÃO — HANDOFF OBRIGATÓRIO

Quando a qualificação estiver completa e você informar que vai preparar ou enviar a cotação, essa é sua última mensagem no atendimento. Escreva uma confirmação curta e, no FINAL ABSOLUTO da resposta, inclua exatamente a tag técnica `[[HANDOFF: QUALIFICACAO_COMPLETA | cotação encaminhada para atendimento manual]]`. Não faça nova pergunta, não continue a conversa depois disso e não mencione a tag ao cliente. Essa tag só pode ser usada quando você realmente encerrou a qualificação e a cotação será assumida manualmente.$rule$),
    v_current.output_instructions,
    v_current.context_config_json,
    v_current.created_by,
    v_current.model_override_enabled
  );
END;
$$;
