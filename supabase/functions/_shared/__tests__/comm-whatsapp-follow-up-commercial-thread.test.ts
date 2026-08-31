import assert from 'node:assert/strict';
import { test } from 'vitest';

import { COMMERCIAL_THREAD_RULE } from '../comm-whatsapp-follow-up-commercial-thread';

test('terceiro decisor: preserva quem participaria da decisao e a escolha pendente', () => {
  assert.match(COMMERCIAL_THREAD_RULE, /esposa, marido, socio, mae/i);
  assert.match(COMMERCIAL_THREAD_RULE, /o que essa pessoa deveria avaliar/i);
  assert.match(COMMERCIAL_THREAD_RULE, /posicionamento facil de responder/i);
  assert.match(COMMERCIAL_THREAD_RULE, /check-in generico/i);
});

test('assunto paralelo: a cronologia posterior nao apaga a oportunidade comercial', () => {
  assert.match(COMMERCIAL_THREAD_RULE, /ultima mensagem cronologica nao e automaticamente/i);
  assert.match(COMMERCIAL_THREAD_RULE, /assuntos paralelos/i);
  assert.match(COMMERCIAL_THREAD_RULE, /nao apagam uma pendencia comercial anterior/i);
});

test('promessa de retorno: exige recuperar compromisso e microdecisao pendentes', () => {
  assert.match(COMMERCIAL_THREAD_RULE, /microdecisao solicitada ou combinada/i);
  assert.match(COMMERCIAL_THREAD_RULE, /cliente assumiu compromisso explicito/i);
  assert.match(COMMERCIAL_THREAD_RULE, /compromisso foi executado/i);
});

test('documentacao: mantem a regra de mudar a estrategia depois de uma tentativa', () => {
  assert.match(COMMERCIAL_THREAD_RULE, /NAO REPETIR ESTRATEGIA/i);
  assert.match(COMMERCIAL_THREAD_RULE, /investigando o bloqueio/i);
  assert.match(COMMERCIAL_THREAD_RULE, /pedindo posicionamento sobre continuidade/i);
});

test('objecao nao resolvida: permanece um fio comercial valido', () => {
  assert.match(COMMERCIAL_THREAD_RULE, /decisao, objecao, compromisso ou acao comercial/i);
  assert.match(COMMERCIAL_THREAD_RULE, /ultimo fio comercial ainda nao resolvido/i);
});

test('contexto humano sensivel: continua acima da retomada comercial', () => {
  assert.match(COMMERCIAL_THREAD_RULE, /nao supera o CONTEXTO HUMANO E EMPATIA/i);
  assert.match(COMMERCIAL_THREAD_RULE, /luto, doenca, cirurgia, internacao/i);
  assert.match(COMMERCIAL_THREAD_RULE, /recomendacao de esperar/i);
});

test('oportunidade encerrada: nao recria artificialmente uma pendencia', () => {
  assert.match(COMMERCIAL_THREAD_RULE, /Nao invente um fio pendente/i);
  assert.match(COMMERCIAL_THREAD_RULE, /contratou outra opcao, decidiu nao seguir/i);
  assert.match(COMMERCIAL_THREAD_RULE, /trate o fio como resolvido/i);
});
