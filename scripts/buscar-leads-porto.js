import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eaxvvhamkmovkoqssahj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function buscarLeadsPorto() {
  console.log('🔍 Buscando menções a "Porto" nas mensagens do inbox...\n');

  // 1. Buscar todas as mensagens que mencionam Porto
  const { data: mensagensPorto, error: errorMensagens } = await supabase
    .from('comm_whatsapp_messages')
    .select(`
      id, 
      chat_id, 
      text_content, 
      media_caption, 
      transcription_text, 
      message_at, 
      direction, 
      message_type,
      sender_name,
      sender_phone
    `)
    .or('text_content.ilike.%porto%,media_caption.ilike.%porto%,transcription_text.ilike.%porto%')
    .order('message_at', { ascending: false });

  if (errorMensagens) {
    console.error('Erro ao buscar mensagens:', errorMensagens);
    return;
  }

  console.log(`📨 Total de mensagens mencionando Porto: ${mensagensPorto?.length || 0}\n`);

  if (!mensagensPorto || mensagensPorto.length === 0) {
    console.log('Nenhuma mensagem encontrada mencionando Porto.');
    return;
  }

  // 2. Agrupar por chat_id
  const chatIds = [...new Set(mensagensPorto.map(m => m.chat_id))];
  console.log(`💬 Chats únicos com menções a Porto: ${chatIds.length}\n`);

  // 3. Buscar dados dos chats
  const { data: chats, error: errorChats } = await supabase
    .from('comm_whatsapp_chats')
    .select('id, lead_id, display_name, phone_number, last_message_at')
    .in('id', chatIds);

  if (errorChats) {
    console.error('Erro ao buscar chats:', errorChats);
    return;
  }

  // 4. Filtrar chats com lead_id
  const chatsComLead = chats?.filter(c => c.lead_id) || [];
  const leadsIds = [...new Set(chatsComLead.map(c => c.lead_id))];

  console.log(`👤 Leads vinculados a esses chats: ${leadsIds.length}\n`);

  if (leadsIds.length === 0) {
    console.log('Nenhum lead encontrado vinculado aos chats com menções a Porto.');
    return;
  }

  // 5. Buscar dados dos leads (sem responsavel_id por enquanto)
  const { data: leads, error: errorLeads } = await supabase
    .from('leads')
    .select(`
      id, 
      nome_completo, 
      telefone, 
      email, 
      operadora_atual, 
      status, 
      responsavel_id, 
      cidade, 
      estado, 
      data_criacao, 
      ultimo_contato,
      observacoes,
      tipo_contratacao_id,
      origem_id
    `)
    .in('id', leadsIds);

  if (errorLeads) {
    console.error('Erro ao buscar leads:', errorLeads);
    return;
  }

  // 6. Buscar nomes dos responsáveis
  const responsavelIds = [...new Set(leads?.map(l => l.responsavel_id).filter(Boolean) || [])];
  let responsaveisMap = {};
  
  if (responsavelIds.length > 0) {
    const { data: responsaveis } = await supabase
      .from('user_profiles')
      .select('id, nome')
      .in('id', responsavelIds);
    
    if (responsaveis) {
      responsaveisMap = Object.fromEntries(responsaveis.map(r => [r.id, r.nome]));
    }
  }

  // 7. Para cada lead, buscar mensagens e contratos
  const leadsComContexto = [];

  for (const lead of leads || []) {
    const chatsDoLead = chatsComLead.filter(c => c.lead_id === lead.id);
    const chatIdsDoLead = chatsDoLead.map(c => c.id);
    const mensagensDoLead = mensagensPorto.filter(m => chatIdsDoLead.includes(m.chat_id));

    const { data: contratos } = await supabase
      .from('contracts')
      .select('id, operadora, produto_plano, mensalidade_total, status, data_criacao')
      .eq('lead_id', lead.id);

    const contratosPorto = contratos?.filter(c => 
      c.operadora?.toLowerCase().includes('porto')
    ) || [];

    const contextoMensagens = mensagensDoLead.map(m => ({
      data: m.message_at ? new Date(m.message_at).toLocaleDateString('pt-BR') : 'N/A',
      hora: m.message_at ? new Date(m.message_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      direcao: m.direction === 'inbound' ? '📥' : '📤',
      remetente: m.sender_name || m.sender_phone || 'Desconhecido',
      texto: m.text_content || m.media_caption || m.transcription_text || '[Sem texto]',
      tipo: m.message_type
    }));

    leadsComContexto.push({
      lead: {
        ...lead,
        responsavel_nome: responsaveisMap[lead.responsavel_id] || 'Não atribuído'
      },
      chats: chatsDoLead,
      mensagens: contextoMensagens,
      contratosPorto
    });
  }

  // 8. Exibir resultados
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 LEADS QUE MENCIONARAM PORTO NO INBOX');
  console.log('═══════════════════════════════════════════════════════════════\n');

  leadsComContexto.forEach((item, index) => {
    const { lead, chats, mensagens, contratosPorto } = item;
    
    console.log(`${index + 1}. ${lead.nome_completo?.toUpperCase() || 'SEM NOME'}`);
    console.log(`   📞 Telefone: ${lead.telefone}`);
    console.log(`   📧 Email: ${lead.email || 'Não informado'}`);
    console.log(`   🏥 Operadora Atual: ${lead.operadora_atual || 'Não informada'}`);
    console.log(`   📋 Status: ${lead.status}`);
    console.log(`   👤 Responsável: ${lead.responsavel_nome}`);
    console.log(`   📍 Localização: ${lead.cidade || ''} ${lead.estado || ''}`.trim() || 'Não informada');
    console.log(`   📅 Data Criação: ${lead.data_criacao ? new Date(lead.data_criacao).toLocaleDateString('pt-BR') : 'Não informada'}`);
    console.log(`   📅 Último Contato: ${lead.ultimo_contato ? new Date(lead.ultimo_contato).toLocaleDateString('pt-BR') : 'Não informado'}`);
    
    if (contratosPorto.length > 0) {
      console.log(`   ✅ JÁ TEM CONTRATO PORTO:`);
      contratosPorto.forEach(c => {
        console.log(`      - ${c.produto_plano} | R$ ${c.mensalidade_total || 0}/mês | Status: ${c.status}`);
      });
    }
    
    if (chats.length > 0) {
      console.log(`   💬 Chat(s):`);
      chats.forEach(c => {
        console.log(`      - ${c.display_name || c.phone_number} (Última msg: ${c.last_message_at ? new Date(c.last_message_at).toLocaleDateString('pt-BR') : 'N/A'})`);
      });
    }
    
    const mensagensRecentes = mensagens.slice(0, 3);
    if (mensagensRecentes.length > 0) {
      console.log(`   📝 Menções a Porto (${mensagens.length} total):`);
      mensagensRecentes.forEach(m => {
        const textoTruncado = m.texto.substring(0, 100) + (m.texto.length > 100 ? '...' : '');
        console.log(`      [${m.data} ${m.hora}] ${m.direcao} "${textoTruncado}"`);
      });
      if (mensagens.length > 3) {
        console.log(`      ... e mais ${mensagens.length - 3} mensagens`);
      }
    }
    
    console.log('');
  });

  // 9. Resumo
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📈 RESUMO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   - Total de mensagens mencionando Porto: ${mensagensPorto.length}`);
  console.log(`   - Chats únicos: ${chatIds.length}`);
  console.log(`   - Leads vinculados: ${leadsIds.length}`);
  
  const statusCount = {};
  leadsComContexto.forEach(item => {
    statusCount[item.lead.status] = (statusCount[item.lead.status] || 0) + 1;
  });
  
  console.log('\n📊 POR STATUS:');
  Object.entries(statusCount).forEach(([status, count]) => {
    console.log(`   - ${status}: ${count}`);
  });

  const responsavelCount = {};
  leadsComContexto.forEach(item => {
    responsavelCount[item.lead.responsavel_nome] = (responsavelCount[item.lead.responsavel_nome] || 0) + 1;
  });
  
  console.log('\n👤 POR RESPONSÁVEL:');
  Object.entries(responsavelCount).forEach(([resp, count]) => {
    console.log(`   - ${resp}: ${count}`);
  });

  const comContratoPorto = leadsComContexto.filter(item => item.contratosPorto.length > 0);
  console.log(`\n✅ JÁ TÊM contrato Porto: ${comContratoPorto.length}`);
  console.log(`⏳ MENCIONARAM Porto mas NÃO TÊM contrato: ${leadsComContexto.length - comContratoPorto.length}`);
}

buscarLeadsPorto().catch(console.error);