import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key',
};

const origensValidas = ['tráfego pago', 'Telein', 'indicação', 'orgânico', 'Ully'] as const;

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

const origemAliasMap: Record<string, (typeof origensValidas)[number]> = origensValidas.reduce(
  (acc, origem) => {
    acc[normalizeText(origem)] = origem;
    return acc;
  },
  {} as Record<string, (typeof origensValidas)[number]>
);

function getCanonicalOrigem(origem?: string): (typeof origensValidas)[number] | null {
  if (!origem || typeof origem !== 'string') {
    return null;
  }

  const normalized = normalizeText(origem);
  return origemAliasMap[normalized] ?? null;
}

interface LeadData {
  nome_completo: string;
  telefone: string;
  email?: string;
  cidade?: string;
  regiao?: string;
  origem: string;
  tipo_contratacao: string;
  operadora_atual?: string;
  status?: string;
  responsavel: string;
  proximo_retorno?: string;
  observacoes?: string;
}

function validateLeadData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.nome_completo || typeof data.nome_completo !== 'string') {
    errors.push('Campo "nome_completo" é obrigatório e deve ser uma string');
  }

  if (!data.telefone || typeof data.telefone !== 'string') {
    errors.push('Campo "telefone" é obrigatório e deve ser uma string');
  }

  if (!data.origem || typeof data.origem !== 'string') {
    errors.push('Campo "origem" é obrigatório e deve ser uma string');
  }

  const origemCanonical = getCanonicalOrigem(data.origem);
  if (data.origem && !origemCanonical) {
    errors.push(`Campo "origem" deve ser um dos valores: ${origensValidas.join(', ')}`);
  } else if (origemCanonical) {
    data.origem = origemCanonical;
  }

  if (!data.tipo_contratacao || typeof data.tipo_contratacao !== 'string') {
    errors.push('Campo "tipo_contratacao" é obrigatório e deve ser uma string');
  }

  const tiposValidos = ['Pessoa Física', 'MEI', 'CNPJ', 'Adesão'];
  if (data.tipo_contratacao && !tiposValidos.includes(data.tipo_contratacao)) {
    errors.push(`Campo "tipo_contratacao" deve ser um dos valores: ${tiposValidos.join(', ')}`);
  }

  if (!data.responsavel || typeof data.responsavel !== 'string') {
    errors.push('Campo "responsavel" é obrigatório e deve ser uma string');
  }

  const responsaveisValidos = ['Luiza', 'Nick'];
  if (data.responsavel && !responsaveisValidos.includes(data.responsavel)) {
    errors.push(`Campo "responsavel" deve ser um dos valores: ${responsaveisValidos.join(', ')}`);
  }

  if (data.email && typeof data.email === 'string') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      errors.push('Campo "email" deve ser um endereço de e-mail válido');
    }
  }

  const statusValidos = ['Novo', 'Em contato', 'Cotando', 'Proposta enviada', 'Fechado', 'Perdido'];
  if (data.status && !statusValidos.includes(data.status)) {
    errors.push(`Campo "status" deve ser um dos valores: ${statusValidos.join(', ')}`);
  }

  return { valid: errors.length === 0, errors };
}

function normalizeTelefone(telefone: string): string {
  return telefone.replace(/\D/g, '');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const path = url.pathname;

    if (path.endsWith('/health')) {
      return new Response(
        JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          service: 'leads-api',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (path.endsWith('/leads') && req.method === 'POST') {
      const body = await req.json();
      const validation = validateLeadData(body);

      if (!validation.valid) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Dados inválidos',
            details: validation.errors,
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const leadData: LeadData = {
        nome_completo: body.nome_completo.trim(),
        telefone: normalizeTelefone(body.telefone),
        email: body.email?.trim() || null,
        cidade: body.cidade?.trim() || null,
        regiao: body.regiao?.trim() || null,
        origem: getCanonicalOrigem(body.origem) ?? body.origem,
        tipo_contratacao: body.tipo_contratacao,
        operadora_atual: body.operadora_atual?.trim() || null,
        status: body.status || 'Novo',
        responsavel: body.responsavel,
        proximo_retorno: body.proximo_retorno || null,
        observacoes: body.observacoes?.trim() || null,
        data_criacao: new Date().toISOString(),
        ultimo_contato: new Date().toISOString(),
        arquivado: false,
      };

      const { data, error } = await supabase
        .from('leads')
        .insert([leadData])
        .select()
        .single();

      if (error) {
        console.error('Erro ao inserir lead:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao criar lead',
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Lead criado com sucesso',
          data: data,
        }),
        {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (path.endsWith('/leads') && req.method === 'GET') {
      const searchParams = url.searchParams;
      const status = searchParams.get('status');
      const responsavel = searchParams.get('responsavel');
      const telefone = searchParams.get('telefone');
      const email = searchParams.get('email');
      const limit = parseInt(searchParams.get('limit') || '100');

      let query = supabase
        .from('leads')
        .select('*')
        .eq('arquivado', false)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) query = query.eq('status', status);
      if (responsavel) query = query.eq('responsavel', responsavel);
      if (telefone) query = query.eq('telefone', normalizeTelefone(telefone));
      if (email) query = query.ilike('email', email);

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar leads:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao buscar leads',
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          count: data.length,
          data: data,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (path.match(/\/leads\/[a-f0-9-]+$/) && req.method === 'PUT') {
      const leadId = path.split('/').pop();
      const body = await req.json();

      const updateData: Partial<LeadData> = {};
      if (body.nome_completo) updateData.nome_completo = body.nome_completo.trim();
      if (body.telefone) updateData.telefone = normalizeTelefone(body.telefone);
      if (body.email !== undefined) updateData.email = body.email?.trim() || null;
      if (body.cidade !== undefined) updateData.cidade = body.cidade?.trim() || null;
      if (body.regiao !== undefined) updateData.regiao = body.regiao?.trim() || null;
      if (body.origem) updateData.origem = body.origem;
      if (body.tipo_contratacao) updateData.tipo_contratacao = body.tipo_contratacao;
      if (body.operadora_atual !== undefined) updateData.operadora_atual = body.operadora_atual?.trim() || null;
      if (body.status) updateData.status = body.status;
      if (body.responsavel) updateData.responsavel = body.responsavel;
      if (body.proximo_retorno !== undefined) updateData.proximo_retorno = body.proximo_retorno || null;
      if (body.observacoes !== undefined) updateData.observacoes = body.observacoes?.trim() || null;

      const { data, error } = await supabase
        .from('leads')
        .update(updateData)
        .eq('id', leadId)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar lead:', error);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao atualizar lead',
            details: error.message,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Lead atualizado com sucesso',
          data: data,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (path.endsWith('/leads/batch') && req.method === 'POST') {
      const body = await req.json();
      
      if (!Array.isArray(body.leads)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Campo "leads" deve ser um array',
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      const results = {
        success: [],
        failed: [],
      };

      for (const [index, leadInput] of body.leads.entries()) {
        const validation = validateLeadData(leadInput);
        
        if (!validation.valid) {
          results.failed.push({
            index,
            data: leadInput,
            errors: validation.errors,
          });
          continue;
        }

        const leadData: LeadData = {
          nome_completo: leadInput.nome_completo.trim(),
          telefone: normalizeTelefone(leadInput.telefone),
          email: leadInput.email?.trim() || null,
          cidade: leadInput.cidade?.trim() || null,
          regiao: leadInput.regiao?.trim() || null,
          origem: leadInput.origem,
          tipo_contratacao: leadInput.tipo_contratacao,
          operadora_atual: leadInput.operadora_atual?.trim() || null,
          status: leadInput.status || 'Novo',
          responsavel: leadInput.responsavel,
          proximo_retorno: leadInput.proximo_retorno || null,
          observacoes: leadInput.observacoes?.trim() || null,
          data_criacao: new Date().toISOString(),
          ultimo_contato: new Date().toISOString(),
          arquivado: false,
        };

        const { data, error } = await supabase
          .from('leads')
          .insert([leadData])
          .select()
          .single();

        if (error) {
          results.failed.push({
            index,
            data: leadInput,
            error: error.message,
          });
        } else {
          results.success.push({
            index,
            data: data,
          });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Processados ${body.leads.length} leads: ${results.success.length} sucesso, ${results.failed.length} falhas`,
          results,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Endpoint não encontrado',
        message: 'Rotas disponíveis: POST /leads, GET /leads, PUT /leads/:id, POST /leads/batch, GET /health',
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Erro interno:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Erro interno do servidor',
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});