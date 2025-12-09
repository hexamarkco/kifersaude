const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Dados dos leads (parte 1 e parte 2 combinados)
const leads = require('./leads_data.json');
const reminders = require('./reminders_data.json');

async function importData() {
  try {
    console.log('Iniciando importação de dados...\n');
    
    // Importar leads
    console.log(`Importando ${leads.length} leads...`);
    const { data: leadsData, error: leadsError } = await supabase
      .from('leads')
      .upsert(leads, { onConflict: 'id' });
    
    if (leadsError) {
      console.error('Erro ao importar leads:', leadsError);
      return;
    }
    console.log(`✓ ${leads.length} leads importados com sucesso!\n`);
    
    // Importar reminders
    console.log(`Importando ${reminders.length} lembretes...`);
    const { data: remindersData, error: remindersError } = await supabase
      .from('reminders')
      .upsert(reminders, { onConflict: 'id' });
    
    if (remindersError) {
      console.error('Erro ao importar lembretes:', remindersError);
      return;
    }
    console.log(`✓ ${reminders.length} lembretes importados com sucesso!\n`);
    
    console.log('Importação concluída!');
  } catch (error) {
    console.error('Erro durante importação:', error);
  }
}

importData();
