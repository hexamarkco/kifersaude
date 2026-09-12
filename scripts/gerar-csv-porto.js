import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'fs';

const supabaseUrl = 'https://eaxvvhamkmovkoqssahj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheHZ2aGFta21vdmtvcXNzYWhqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTgzMTY3MywiZXhwIjoyMDc3NDA3NjczfQ.RpbKiLFtqXGrWAP1oI6UxHS7B184DAebAMEDAnbn3V8';

const supabase = createClient(supabaseUrl, supabaseKey);

const CNPJ_ID = 'd39dd4c5-1bbd-4c35-a9a5-c55849abc434';
const MEI_ID = '78df932e-3977-4364-9ff0-258060912910';

async function gerarCSV() {
  const { data: leads } = await supabase
    .from('leads')
    .select(`
      id, nome_completo, telefone, email, status, 
      tipo_contratacao_id, observacoes, data_criacao, ultimo_contato
    `)
    .in('tipo_contratacao_id', [CNPJ_ID, MEI_ID]);

  if (!leads) return;

  const results = [];

  for (const lead of leads) {
    // Buscar vidas
    let totalVidas = null;
    let fonteVidas = '';

    const { data: contratos } = await supabase
      .from('contracts')
      .select('vidas')
      .eq('lead_id', lead.id);

    if (contratos?.length) {
      const c = contratos.find(c => c.vidas > 0);
      if (c) { totalVidas = c.vidas; fonteVidas = 'contrato'; }
    }

    if (!totalVidas && lead.observacoes) {
      const m = lead.observacoes.match(/(\d+)\s*(vida|vidas)/i);
      if (m) { totalVidas = parseInt(m[1]); fonteVidas = 'observações'; }
    }

    if (!totalVidas) {
      const { data: chats } = await supabase
        .from('comm_whatsapp_chats')
        .select('id')
        .eq('lead_id', lead.id);

      if (chats?.length) {
        const { data: msgs } = await supabase
          .from('comm_whatsapp_messages')
          .select('text_content')
          .in('chat_id', chats.map(c => c.id))
          .or('text_content.ilike.%vida%,text_content.ilike.%vidas%')
          .limit(15);

        if (msgs) {
          for (const msg of msgs) {
            const m = (msg.text_content || '').match(/(\d+)\s*(vida|vidas)/i);
            if (m) { totalVidas = parseInt(m[1]); fonteVidas = 'mensagens'; break; }
          }
        }
      }
    }

    if (!totalVidas || totalVidas < 3) continue;

    // Buscar menções Porto
    const { data: chats } = await supabase
      .from('comm_whatsapp_chats')
      .select('id')
      .eq('lead_id', lead.id);

    let mencoesPorto = 0;
    if (chats?.length) {
      const { data: msgs } = await supabase
        .from('comm_whatsapp_messages')
        .select('id')
        .in('chat_id', chats.map(c => c.id))
        .or('text_content.ilike.%porto%,media_caption.ilike.%porto%,transcription_text.ilike.%porto%');
      mencoesPorto = msgs?.length || 0;
    }

    const tipo = lead.tipo_contratacao_id === CNPJ_ID ? 'CNPJ' : 'MEI';
    const prioridade = mencoesPorto > 0 ? 'ALTA' : 'BAIXA';

    results.push({
      prioridade,
      nome: lead.nome_completo || '',
      telefone: lead.telefone || '',
      email: lead.email || '',
      tipo,
      vidas: totalVidas,
      fonte_vidas: fonteVidas,
      mencoes_porto: mencoesPorto,
      status: lead.status || '',
      data_criacao: lead.data_criacao ? new Date(lead.data_criacao).toLocaleDateString('pt-BR') : '',
      ultimo_contato: lead.ultimo_contato ? new Date(lead.ultimo_contato).toLocaleDateString('pt-BR') : ''
    });
  }

  // Ordenar: ALTA primeiro
  results.sort((a, b) => {
    if (a.prioridade === 'ALTA' && b.prioridade !== 'ALTA') return -1;
    if (a.prioridade !== 'ALTA' && b.prioridade === 'ALTA') return 1;
    return b.mencoes_porto - a.mencoes_porto;
  });

  // Gerar CSV
  const header = 'Prioridade,Nome,Telefone,Email,Tipo,Vidas,Fonte Vidas,Menções Porto,Status,Data Criação,Último Contato';
  const rows = results.map(r => 
    `${r.prioridade},"${r.nome}","${r.telefone}","${r.email}",${r.tipo},${r.vidas},${r.fonte_vidas},${r.mencoes_porto},"${r.status}",${r.data_criacao},${r.ultimo_contato}`
  );

  const csv = [header, ...rows].join('\n');
  
  writeFileSync('leads-porto-cnpj-3plus-vidas.csv', csv, 'utf-8');
  
  console.log(`✅ CSV gerado: leads-porto-cnpj-3plus-vidas.csv`);
  console.log(`📊 Total: ${results.length} leads`);
  console.log(`🔴 Prioridade ALTA: ${results.filter(r => r.prioridade === 'ALTA').length}`);
  console.log(`🟡 Prioridade BAIXA: ${results.filter(r => r.prioridade === 'BAIXA').length}`);
}

gerarCSV().catch(console.error);