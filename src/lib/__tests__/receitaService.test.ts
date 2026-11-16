import assert from 'node:assert/strict';
import { test, vi } from 'vitest';
import { consultarEmpresaPorCNPJ } from '../receitaService';

test('consulta CNPJ sem máscara e preserva os campos usados no contrato e no titular', async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async (input) => {
    urls.push(String(input));
    return new Response(JSON.stringify({
      razao_social: 'EMPRESA EXEMPLO LTDA', nome_fantasia: 'EXEMPLO',
      cep: '24020000', logradouro: 'RUA EXEMPLO', numero: '10',
      complemento: 'SALA 2', bairro: 'CENTRO', municipio: 'NITERÓI', uf: 'RJ',
    }));
  };
  try {
    assert.deepEqual(await consultarEmpresaPorCNPJ('00.000.000/0001-91'), {
      razao_social: 'EMPRESA EXEMPLO LTDA', nome_fantasia: 'EXEMPLO',
      cep: '24020000', endereco: 'RUA EXEMPLO', numero: '10',
      complemento: 'SALA 2', bairro: 'CENTRO', cidade: 'NITERÓI', estado: 'RJ',
    });
    assert.equal(urls.length, 1);
    assert.ok(urls[0].endsWith('/cnpj/v1/00000000000191'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejeita CNPJ incompleto antes de acessar o serviço externo', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return new Response('{}'); };
  try {
    await assert.rejects(consultarEmpresaPorCNPJ('123'), /CNPJ inválido/);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

const alternativeCompany = {
  razao_social: 'EMPRESA ALTERNATIVA LTDA',
  estabelecimento: {
    nome_fantasia: 'ALTERNATIVA', cep: '24020000',
    tipo_logradouro: 'RUA', logradouro: 'EXEMPLO', numero: '10',
    complemento: null, bairro: 'CENTRO', cidade: { nome: 'NITERÓI' }, estado: { sigla: 'RJ' },
  },
};

test('recupera consulta bloqueada, sem CORS ou sem dados usando fonte alternativa', async () => {
  const originalFetch = globalThis.fetch;
  const failures = [
    () => new Response('Forbidden', { status: 403 }),
    () => { throw new TypeError('Failed to fetch'); },
    () => new Response('Not found', { status: 404 }),
    () => new Response('{}'),
    () => new Response('<html>Serviço indisponível</html>'),
  ];
  try {
    for (const failure of failures) {
      const urls: string[] = [];
      globalThis.fetch = async (input) => {
        urls.push(String(input));
        if (urls.length === 1) return failure();
        return new Response(JSON.stringify(alternativeCompany));
      };
      assert.deepEqual(await consultarEmpresaPorCNPJ('00.000.000/0001-91'), {
        razao_social: 'EMPRESA ALTERNATIVA LTDA', nome_fantasia: 'ALTERNATIVA',
        cep: '24020000', endereco: 'RUA EXEMPLO', numero: '10', complemento: undefined,
        bairro: 'CENTRO', cidade: 'NITERÓI', estado: 'RJ',
      });
      assert.equal(urls[1], 'https://publica.cnpj.ws/cnpj/00000000000191');
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('limita o tempo de espera e consulta a alternativa quando a primeira fonte trava', async () => {
  const originalFetch = globalThis.fetch;
  vi.useFakeTimers();
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls += 1;
    if (calls === 2) return new Response(JSON.stringify(alternativeCompany));
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  };
  try {
    const lookup = consultarEmpresaPorCNPJ('00000000000191');
    await vi.advanceTimersByTimeAsync(8000);
    assert.equal((await lookup).razao_social, 'EMPRESA ALTERNATIVA LTDA');
    assert.equal(calls, 2);
    assert.equal(vi.getTimerCount(), 0);
  } finally {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  }
});

test('mostra orientação de negócio quando todas as fontes falham, sem exibir payload técnico', async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const [status, message] of [
      [404, /CNPJ não encontrado.*Confira o número/],
      [429, /limite de consultas.*Aguarde um minuto/],
      [503, /indisponível.*preencha os dados da empresa manualmente/],
    ] as const) {
      globalThis.fetch = async () => new Response('<html>Erro interno do provedor</html>', { status });
      await assert.rejects(consultarEmpresaPorCNPJ('00000000000191'), message);
    }
    globalThis.fetch = async () => new Response('{}');
    await assert.rejects(consultarEmpresaPorCNPJ('00000000000191'), /indisponível/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
