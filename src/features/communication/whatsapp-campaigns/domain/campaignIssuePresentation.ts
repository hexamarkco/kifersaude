export type CampaignIssuePresentation = {
  title: string;
  guidance: string;
};

export function groupCampaignIssues(rows: Array<{ error_message: string; total_count: number }>) {
  const groups = new Map<string, { reason: string; count: number; details: string[] }>();
  for (const row of rows) {
    const issue = describeCampaignIssue(row.error_message);
    const key = `${issue.title}|${issue.guidance}`;
    const group = groups.get(key) || { reason: row.error_message, count: 0, details: [] };
    group.count += row.total_count;
    group.details.push(`${row.total_count} contato(s): ${row.error_message}`);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

export function describeCampaignIssue(reason: string): CampaignIssuePresentation {
  if (/incerto|amb[ií]guo|sem confirma|confirma[çc][aã]o.*n[aã]o.*persist|reenvio duplicado/i.test(reason)) {
    return { title: 'Envio precisa de conferência', guidance: 'Não foi possível confirmar se a mensagem saiu. Confira a conversa antes de tentar novamente.' };
  }
  if (/intervalo.*admiss[aã]o|pacing|round_robin|limite di[aá]rio|cota|janela de envio/i.test(reason)) {
    return { title: 'Aguardando o próximo horário de envio', guidance: 'A campanha poderá continuar automaticamente quando estiver dentro dos horários e limites definidos.' };
  }
  if (/opt.?out|contact_permission_blocked|pediu.*n[aã]o receber/i.test(reason)) {
    return { title: 'Contato pediu para não receber mensagens', guidance: 'Respeite a escolha do contato e mantenha as mensagens comerciais bloqueadas.' };
  }
  if (/identidade|destinat[aá]rio|n[uú]mero errado/i.test(reason)) {
    return { title: 'Confira os dados do contato', guidance: 'Confirme o número e a pessoa antes de iniciar novos envios.' };
  }
  if (/telefone inv[aá]lido|n[uú]mero inv[aá]lido|sem WhatsApp|not on whatsapp/i.test(reason)) {
    return { title: 'Número de WhatsApp inválido', guidance: 'Confira o telefone com DDD no cadastro do contato.' };
  }
  if (/uuid|invalid input syntax|constraint|dispatch|postgrest|pgrst|schema|does not exist|column|relation/i.test(reason)) {
    return { title: 'Não foi possível atualizar o envio', guidance: 'Peça ajuda ao responsável pelo sistema. Confira a conversa antes de tentar um novo envio.' };
  }
  if (/mensagem vazia|sem mensagem definida/i.test(reason)) {
    return { title: 'A mensagem precisa ser preenchida', guidance: 'Confira o texto da etapa na edição da campanha.' };
  }
  if (/anexo|m[ií]dia|media|mime|arquivo/i.test(reason)) {
    return { title: 'Não foi possível enviar o anexo', guidance: 'Confira o arquivo da campanha e verifique a conversa antes de tentar novamente.' };
  }
  return { title: 'Não foi possível concluir o envio', guidance: 'Confira a conversa para saber o que chegou ao contato. Se precisar de ajuda, compartilhe os detalhes com o responsável pelo sistema.' };
}
