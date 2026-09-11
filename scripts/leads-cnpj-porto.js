import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eaxvvhamkmovkoqssahj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function buscarLeadsCNPJ() {
  console.log('🔍 Buscando leads com CNPJ/MEI, 3+ vidas...\n');

  // 1. Buscar leads que são CNPJ ou MEI
  const { data: leads, error: errorLeads } = await supabase
    .from('leads')
    .select(`
      id, 
      nome_completo, 
      telefone, 
      email, 
      status, 
      responsavel_id,
      tipo_contratacao,
      observacoes,
      data_criacao,
      ultimo_contato
    `)
    .in('tipo_contratacao', ['CNPJ', 'MEI']);

  if (errorLeads) {
    console.error('Erro ao buscar leads:', errorLeads);
    return;
  }

  console.log(`📊 Total de leads CNPJ/MEI: ${leads?.length || 0}\n`);

  if (!leads || leads.length === 0) {
    console.log('Nenhum lead CNPJ/MEI encontrado.');
    return;
  }

  // 2. Para cada lead, verificar: vidas (contrato), menções a Porto
  const leadsComInfo = [];

  for (const lead of leads) {
    // Buscar contratos do lead
    const { data: contratos } = await supabase
      .from('contracts')
      .select('id, operadora, vidas, produto_plano, mensalidade_total, status')
      .eq('lead_id', lead.id);

    // Buscar vidas do contrato
    let totalVidas = null;
    if (contratos && contratos.length > 0) {
      const contratoComVidas = contratos.find(c => c.vidas && c.vidas > 0);
      if (contratoComVidas) {
        totalVidas = contratoComVidas.vidas;
      }
    }

    // Se não tem contrato com vidas, buscar nas observações
    if (!totalVidas && lead.observacoes) {
      const match = lead.observacoes.match(/(\d+)\s*(vida|vidas|dependente|dependentes|beneficiário|beneficiários)/i);
      if (match) {
        totalVidas = parseInt(match[1]);
      }
    }

    // Se não tem vidas, pular (não atende critério)
    if (!totalVidas || totalVidas < 3) {
      continue;
    }

    // Buscar chats do lead
    const { data: chats } = await supabase
      .from('comm_whatsapp_chats')
      .select('id')
      .eq('lead_id', lead.id);

    let mencionouPorto = false;
    let totalMencoesPorto = 0;

    if (chats && chats.length > 0) {
      const chatIds = chats.map(c => c.id);
      
      // Contar menções a Porto
      const { data: mensagensPorto } = await supabase
        .from('comm_whatsapp_messages')
        .select('id')
        .in('chat_id', chatIds)
        .or('text_content.ilike.%porto%,media_caption.ilike.%porto%,transcription_text.ilike.%porto%');

      if (mensagensPorto && mensagensPorto.length > 0) {
        mencionouPorto = true;
        totalMencoesPorto = mensagensPorto.length;
      }
    }

    leadsComInfo.push({
      ...lead,
      totalVidas,
      mencionouPorto,
      totalMencoesPorto,
      contratos: contratos || []
    });
  }

  // 3. Classificar
  const alto = leadsComInfo.filter(l => l.mencionouPorto);
  const baixo = leadsComInfo.filter(l => !l.mencionouPorto);

  // 4. Exibir resultados
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🎯 PRIORIDADE ALTA - CNPJ/MEI + 3+ VIDAS + FALARAM SOBRE PORTO');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (alto.length === 0) {
    console.log('Nenhum lead encontrado nesta categoria.\n');
  } else {
    alto.forEach((lead, index) => {
      console.log(`${index + 1}. ${lead.nome_completo?.toUpperCase()}`);
      console.log(`   📞 Telefone: ${lead.telefone}`);
      console.log(`   📧 Email: ${lead.email || 'Não informado'}`);
      console.log(`   📋 Status: ${lead.status}`);
      console.log(`   🏢 Tipo: ${lead.tipo_contratacao}`);
      console.log(`   👥 Vidas: ${lead.totalVidas}`);
      console.log(`   💬 Menções a Porto: ${lead.totalMencoesPorto}`);
      console.log(`   📅 Data Criação: ${lead.data_criacao ? new Date(lead.data_criacao).toLocaleDateString('pt-BR') : 'N/A'}`);
      console.log(`   📅 Último Contato: ${lead.ultimo_contato ? new Date(lead.ultimo_contato).toLocaleDateString('pt-BR') : 'N/A'}`);
      console.log('');
    });
  }

  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📉 PRIORIDADE BAIXA - CNPJ/MEI + 3+ VIDAS + NÃO FALARAM PORTO');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (baixo.length === 0) {
    console.log('Nenhum lead encontrado nesta categoria.\n');
  } else {
    baixo.forEach((lead, index) => {
      console.log(`${index + 1}. ${lead.nome_completo?.toUpperCase()}`);
      console.log(`   📞 Telefone: ${lead.telefone}`);
      console.log(`   📧 Email: ${lead.email || 'Não informado'}`);
      console.log(`   📋 Status: ${lead.status}`);
      console.log(`   🏢 Tipo: ${lead.tipo_contratacao}`);
      console.log(`   👥 Vidas: ${lead.totalVidas}`);
      console.log(`   📅 Data Criação: ${lead.data_criacao ? new Date(lead.data_criacao).toLocaleDateString('pt-BR') : 'N/A'}`);
      console.log(`   📅 Último Contato: ${lead.ultimo_contato ? new Date(lead.ultimo_contato).toLocaleDateString('pt-BR') : 'N/A'}`);
      console.log('');
    });
  }

  // Resumo
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📈 RESUMO');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   - Total CNPJ/MEI com 3+ vidas: ${leadsComInfo.length}`);
  console.log(`   - 🔴 Prioridade ALTA (falaram Porto): ${alto.length}`);
  console.log(`   - 🟡 Prioridade BAIXA (não falaram Porto): ${baixo.length}`);
}

buscarLeadsCNPJ().catch(console.error);