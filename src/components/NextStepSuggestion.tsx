import { Lightbulb, ArrowRight } from 'lucide-react';

type NextStepSuggestionProps = {
  leadStatus: string;
  lastContact?: string;
};

const SUGGESTIONS: Record<string, { title: string; actions: string[] }> = {
  'Novo': {
    title: 'Primeiro Contato',
    actions: [
      'Entrar em contato para se apresentar e entender preferências de comunicação',
      'Perguntar sobre a urgência e necessidades do plano',
      'Agendar uma ligação ou reunião para entender melhor',
      'Enviar material institucional sobre sua empresa',
    ],
  },
  'Em contato': {
    title: 'Qualificar o Lead',
    actions: [
      'Identificar o perfil: PF, MEI, CNPJ ou Adesão',
      'Entender quantidade de vidas e faixa etária',
      'Perguntar sobre abrangência desejada e coparticipação',
      'Verificar se possui operadora atual e motivo da troca',
    ],
  },
  'Cotando': {
    title: 'Preparar Proposta',
    actions: [
      'Cotar com pelo menos 3 operadoras diferentes',
      'Preparar tabela comparativa com pros e contras',
      'Calcular valores com e sem coparticipação',
      'Preparar apresentação personalizada para o cliente',
    ],
  },
  'Proposta enviada': {
    title: 'Acompanhar Proposta',
    actions: [
      'Ligar em 24h para confirmar recebimento',
      'Esclarecer dúvidas sobre a proposta enviada',
      'Criar senso de urgência (validade, reajustes)',
      'Oferecer reunião para explicar detalhes',
    ],
  },
  'Fechado': {
    title: 'Pós-Venda',
    actions: [
      'Parabenizar pela decisão e agradecer',
      'Explicar próximos passos e documentação',
      'Agendar reunião de onboarding',
      'Pedir indicações de novos clientes',
    ],
  },
  'Perdido': {
    title: 'Análise e Aprendizado',
    actions: [
      'Registrar motivo da perda para análise',
      'Manter contato educacional (enviar dicas, novidades)',
      'Agendar retorno em 3-6 meses',
      'Pedir feedback sobre o atendimento',
    ],
  },
};

export default function NextStepSuggestion({ leadStatus, lastContact }: NextStepSuggestionProps) {
  const suggestion = SUGGESTIONS[leadStatus];

  if (!suggestion) return null;

  const getDaysInactive = (): number => {
    if (!lastContact) return 999;
    const lastContactDate = new Date(lastContact);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastContactDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysInactive = getDaysInactive();
  const isUrgent = daysInactive > 3 && leadStatus !== 'Fechado' && leadStatus !== 'Perdido';

  return (
    <div className={`rounded-lg p-4 border-2 ${
      isUrgent
        ? 'bg-orange-50 border-orange-300'
        : 'bg-teal-50 border-teal-300'
    }`}>
      <div className="flex items-start space-x-3">
        <div className={`p-2 rounded-lg flex-shrink-0 ${
          isUrgent ? 'bg-orange-200' : 'bg-teal-200'
        }`}>
          <Lightbulb className={`w-5 h-5 ${
            isUrgent ? 'text-orange-700' : 'text-teal-700'
          }`} />
        </div>
        <div className="flex-1">
          <h4 className={`font-semibold mb-2 ${
            isUrgent ? 'text-orange-900' : 'text-teal-900'
          }`}>
            {isUrgent && '⚠️ Atenção: '} Próximos Passos - {suggestion.title}
          </h4>
          {isUrgent && (
            <p className="text-sm text-orange-800 mb-3 font-medium">
              Este lead está {daysInactive} dias sem contato. É importante agir rapidamente!
            </p>
          )}
          <ul className="space-y-2">
            {suggestion.actions.map((action, index) => (
              <li
                key={index}
                className={`flex items-start space-x-2 text-sm ${
                  isUrgent ? 'text-orange-800' : 'text-teal-800'
                }`}
              >
                <ArrowRight className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{action}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
