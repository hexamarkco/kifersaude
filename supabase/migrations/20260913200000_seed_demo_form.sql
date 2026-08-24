/*
  # Demo form: "Simulação de Plano de Saúde" (/forms/simulacao)

  ## Description
  Seeds one published, ready-to-use form that showcases every capability of
  the public forms builder in a single flow: single choice (with auto-advance),
  multiple choice, short text mapped to the Lead's `cidade`, single choice
  mapped to the Lead's `tipo_contratacao`, optional browser geolocation, a
  customized success screen and a WhatsApp redirect with a {{nome}} template.

  Idempotent: re-running this migration is a no-op once the form (matched by
  slug) and its steps already exist.
*/

DO $$
DECLARE
  v_form_id uuid;
BEGIN
  INSERT INTO public_forms (
    slug,
    title,
    description,
    success_headline,
    success_message,
    whatsapp_redirect,
    whatsapp_message_template,
    request_geolocation,
    is_published
  )
  VALUES (
    'simulacao',
    'Simulação de Plano de Saúde',
    'Responda 5 perguntas rápidas e receba uma simulação personalizada de plano de saúde em minutos.',
    'Simulação enviada com sucesso!',
    'Nossa equipe já está preparando sua proposta personalizada e vai te chamar no WhatsApp em instantes.',
    true,
    'Olá! Sou {{nome}} e acabei de fazer a simulação de plano de saúde no site da Kifer.',
    true,
    true
  )
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_form_id;

  IF v_form_id IS NULL THEN
    SELECT id INTO v_form_id FROM public_forms WHERE slug = 'simulacao';
  END IF;

  IF v_form_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public_form_steps WHERE form_id = v_form_id) THEN
    INSERT INTO public_form_steps (form_id, position, step_type, title, description, placeholder, is_required, field_key, options)
    VALUES
      (
        v_form_id, 0, 'single_choice',
        'Você já tem plano de saúde hoje?',
        NULL, NULL, true, NULL,
        '[
          {"id":"tem","label":"Sim, já tenho plano"},
          {"id":"nao","label":"Não tenho plano"},
          {"id":"cancelei","label":"Tive e cancelei"}
        ]'::jsonb
      ),
      (
        v_form_id, 1, 'single_choice',
        'Para quem é o plano?',
        'Isso ajuda a te mostrar as melhores opções de contratação.',
        NULL, true, 'tipo_contratacao',
        '[
          {"id":"pf","label":"Individual ou familiar","value":"PF"},
          {"id":"mei","label":"Sou MEI","value":"MEI"},
          {"id":"cnpj","label":"Tenho uma empresa (CNPJ)","value":"CNPJ"}
        ]'::jsonb
      ),
      (
        v_form_id, 2, 'multi_choice',
        'O que é mais importante pra você na hora de escolher?',
        'Pode marcar mais de uma opção.',
        NULL, true, NULL,
        '[
          {"id":"preco","label":"Preço baixo"},
          {"id":"rede","label":"Rede de hospitais ampla"},
          {"id":"atendimento","label":"Atendimento rápido"},
          {"id":"nacional","label":"Cobertura nacional"},
          {"id":"carencia","label":"Sem carência"}
        ]'::jsonb
      ),
      (
        v_form_id, 3, 'short_text',
        'Em qual cidade você mora?',
        NULL, 'Ex: Rio de Janeiro', true, 'cidade',
        '[]'::jsonb
      ),
      (
        v_form_id, 4, 'single_choice',
        'Quantas pessoas entram no plano?',
        NULL, NULL, true, NULL,
        '[
          {"id":"1","label":"Só eu"},
          {"id":"2","label":"2 pessoas"},
          {"id":"3-5","label":"3 a 5 pessoas"},
          {"id":"5+","label":"Mais de 5 pessoas"}
        ]'::jsonb
      ),
      (
        v_form_id, 5, 'contact',
        'Perfeito! Prepare-se para receber sua simulação',
        'Em poucos minutos nosso time te chama no WhatsApp com a melhor proposta.',
        NULL, true, NULL,
        '[]'::jsonb
      );
  END IF;
END $$;
