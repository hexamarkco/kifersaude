import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://eaxvvhamkmovkoqssahj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8';

const supabase = createClient(supabaseUrl, supabaseKey);

// Leads prioritários identificados (Proposta Enviada / Em atendimento)
const leadsPrioritarios = [
  { nome: 'BRENDA LORRANA', telefone: '554197619809', email: 'Não informado' },
  { nome: 'MARIA JOSÉ PINTO AMARAL', telefone: '21994146537', email: 'mariajosepintoamaral4@gmail.com' },
  { nome: 'JORGE NUNEZ', telefone: '5521996590122', email: 'Não informado' },
  { nome: 'RAFAELLA JOAZEIRO', telefone: '4591456135', email: 'rafajoazeiro@hotmail.com' },
  { nome: 'LUCIA NASCIMENTO', telefone: '21981672462', email: 'lucianascimento6936@gmail.com' },
  { nome: 'PATRICIA ARAUJO', telefone: '21994415261', email: 'patricia.0188.araujo@gmail.com' },
  { nome: 'TEREZA', telefone: '21985576899', email: 'Não informado' },
  { nome: 'DAYANA FONSECA', telefone: '22998838180', email: 'dayana.fonseca.soares@gmail.com' },
  // Adicionando alguns de reativação que parecem quentes
  { nome: 'KARLA', telefone: '22981166665', email: 'tntkarlinh@gmail.com' },
  { nome: 'IGOR RANGEL', telefone: '21960169454', email: 'rangeladvogadosrj@gmail.com' },
  { nome: 'JULIANA CAVALCANTE', telefone: '5521988174667', email: 'Não informado' },
];

async function verificarVidas() {
  console.log('🔍 Verificando número de vidas dos leads prioritários...\n');

  const leadsComVidas = [];

  for (const lead of leadsPrioritarios) {
    // Buscar lead por telefone
    const { data: leadData, error: errorLead } = await supabase
      .from('leads')
      .select('id, nome_completo, telefone, email, status, observacoes')
      .eq('telefone', lead.telefone)
      .single();

    if (errorLead || !leadData) {
      console.log(`❌ ${lead.nome} - Lead não encontrado no banco`);
      continue;
    }

    // Buscar contratos do lead
    const { data: contratos, error: errorContratos } = await supabase
      .from('contracts')
      .select('id, operadora, vidas, vidas_elegiveis_bonus, produto_plano, mensalidade_total, status')
      .eq('lead_id', leadData.id);

    let totalVidas = null;
    let fonte = 'não encontrada';
    let detalhes = '';

    // Se tem contrato, usar a coluna vidas
    if (contratos && contratos.length > 0) {
      const contratoComVidas = contratos.find(c => c.vidas && c.vidas > 0);
      if (contratoComVidas) {
        totalVidas = contratoComVidas.vidas;
        fonte = 'contrato';
        detalhes = `Contrato: ${contratoComVidas.produto_plano} | ${contratoComVidas.vidas} vidas | Status: ${contratoComVidas.status}`;
      }
    }

    // Se não encontrou no contrato, buscar nas mensagens por menção a vidas
    if (!totalVidas) {
      const { data: chats } = await supabase
        .from('comm_whatsapp_chats')
        .select('id')
        .eq('lead_id', leadData.id);

      if (chats && chats.length > 0) {
        const chatIds = chats.map(c => c.id);
        
        // Buscar mensagens mencionando "vida" ou "vidas"
        const { data: mensagens } = await supabase
          .from('comm_whatsapp_messages')
          .select('text_content, media_caption, transcription_text')
          .in('chat_id', chatIds)
          .or('text_content.ilike.%vida%,text_content.ilike.%vidas%,text_content.ilike.%dependente%,text_content.ilike.%beneficiário%')
          .order('message_at', { ascending: false })
          .limit(10);

        if (mensagens && mensagens.length > 0) {
          // Procurar padrões como "3 vidas", "4 vidas", etc.
          for (const msg of mensagens) {
            const texto = msg.text_content || msg.media_caption || msg.transcription_text || '';
            const match = texto.match(/(\d+)\s*(vida|vidas|dependente|dependentes|beneficiário|beneficiários)/i);
            if (match) {
              totalVidas = parseInt(match[1]);
              fonte = 'mensagens';
              detalhes = `Encontrado na mensagem: "${texto.substring(0, 100)}..."`;
              break;
            }
          }
        }
      }
    }

    // Se ainda não encontrou, verificar observações do lead
    if (!totalVidas && leadData.observacoes) {
      const match = leadData.observacoes.match(/(\d+)\s*(vida|vidas|dependente|dependentes|beneficiário|beneficiários)/i);
      if (match) {
        totalVidas = parseInt(match[1]);
        fonte = 'observações';
        detalhes = `Observação: "${leadData.observacoes.substring(0, 100)}..."`;
      }
    }

    leadsComVidas.push({
      ...leadData,
      totalVidas,
      fonte,
      detalhes,
      contratos: contratos || []
    });

    // Exibir resultado
    const statusVidas = totalVidas ? (totalVidas >= 3 ? '✅' : '⚠️') : '❓';
    console.log(`${statusVidas} ${leadData.nome_completo}`);
    console.log(`   📞 ${leadData.telefone}`);
    console.log(`   📊 Vidas: ${totalVidas || 'Não identificada'} (${fonte})`);
    if (detalhes) {
      console.log(`   📝 ${detalhes}`);
    }
    console.log('');
  }

  // Resumo
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 RESUMO - LEADS COM 3+ VIDAS (ELEGÍVEIS PORTO)');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const com3OuMais = leadsComVidas.filter(l => l.totalVidas && l.totalVidas >= 3);
  const comMenos3 = leadsComVidas.filter(l => l.totalVidas && l.totalVidas < 3);
  const semInfo = leadsComVidas.filter(l => !l.totalVidas);

  if (com3OuMais.length > 0) {
    console.log('✅ ELEGÍVEIS PARA PORTO (3+ vidas):');
    com3OuMais.forEach(l => {
      console.log(`   - ${l.nome_completo} (${l.totalVidas} vidas) - ${l.telefone}`);
    });
  }

  if (comMenos3.length > 0) {
    console.log('\n⚠️ NÃO ELEGÍVEIS (menos de 3 vidas):');
    comMenos3.forEach(l => {
      console.log(`   - ${l.nome_completo} (${l.totalVidas} vidas) - ${l.telefone}`);
    });
  }

  if (semInfo.length > 0) {
    console.log('\n❓ SEM INFORMAÇÃO DE VIDAS:');
    semInfo.forEach(l => {
      console.log(`   - ${l.nome_completo} - ${l.telefone}`);
    });
  }

  console.log(`\n📈 Total: ${com3OuMais.length} elegíveis | ${comMenos3.length} não elegíveis | ${semInfo.length} sem info`);
}

verificarVidas().catch(console.error);