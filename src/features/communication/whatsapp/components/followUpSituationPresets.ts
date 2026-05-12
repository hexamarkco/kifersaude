export type ConversationSituationPresetId =
  | 'cliente_sumiu'
  | 'achou_caro'
  | 'comparando_concorrente'
  | 'pediu_retorno_depois'
  | 'aguardando_documentos';

export type ConversationSituationPreset = {
  id: ConversationSituationPresetId;
  label: string;
  instruction: string;
};

export const CONVERSATION_SITUATION_PRESETS: ConversationSituationPreset[] = [
  {
    id: 'cliente_sumiu',
    label: 'Cliente sumiu',
    instruction:
      'Cenário: cliente parou de responder. Faça um follow-up curto, leve e sem cobrança. Reforce que está disponível para ajudar e termine com uma pergunta simples para retomar a conversa.',
  },
  {
    id: 'achou_caro',
    label: 'Achou caro',
    instruction:
      'Cenário: cliente achou o plano caro. Reconheça a preocupação com preço, destaque valor e adequação do plano, ofereça revisar alternativas e evite tom defensivo.',
  },
  {
    id: 'comparando_concorrente',
    label: 'Comparando concorrente',
    instruction:
      'Cenário: cliente está comparando com concorrentes. Oriente a mensagem a comparar benefícios, rede, carências e suporte de forma objetiva, sem desqualificar outras empresas.',
  },
  {
    id: 'pediu_retorno_depois',
    label: 'Pediu retorno depois',
    instruction:
      'Cenário: cliente pediu para retornar depois. Seja respeitoso com o prazo, mencione que está retomando conforme combinado e proponha um próximo passo objetivo.',
  },
  {
    id: 'aguardando_documentos',
    label: 'Aguardando documentos',
    instruction:
      'Cenário: estamos aguardando documentos. Lembre de forma cordial quais documentos faltam, explique que eles são necessários para avançar e ofereça ajuda em caso de dúvida.',
  },
];
