import assert from 'node:assert/strict';
import { test } from 'vitest';

import { formatCommWhatsAppPhoneLabel, getCommWhatsAppPhoneRegion } from '../phonePresentation';

test('formats Brazilian WhatsApp numbers without changing private identifiers', () => {
  assert.equal(formatCommWhatsAppPhoneLabel('5511999999999'), '+55 (11) 99999-9999');
  assert.equal(formatCommWhatsAppPhoneLabel('551133334444'), '+55 (11) 3333-4444');
  assert.equal(formatCommWhatsAppPhoneLabel('12345@lid'), 'Contato privado');
  assert.equal(formatCommWhatsAppPhoneLabel(null), 'Contato privado');
});

test('identifica a região de celulares e fixos com ou sem DDI, inclusive DDD 55', () => {
  for (const phone of ['5521969263786', '+55 (21) 96926-3786', '(21) 96926-3786', '21969263786', '2123456789']) {
    assert.deepEqual(getCommWhatsAppPhoneRegion(phone), { ddd: '21', uf: 'RJ', name: 'Rio de Janeiro' });
  }
  for (const phone of ['5555999999999', '55999999999', '5533334444', '+55 (55) 3333-4444']) {
    assert.deepEqual(getCommWhatsAppPhoneRegion(phone), { ddd: '55', uf: 'RS', name: 'Rio Grande do Sul' });
  }
});

test('distingue regiões e mantém a ambiguidade do DDD 61', () => {
  const cases = [
    ['11', 'SP'], ['27', 'ES'], ['33', 'MG'], ['41', 'PR'], ['48', 'SC'],
    ['61', 'DF/GO'], ['62', 'GO'], ['63', 'TO'], ['65', 'MT'], ['67', 'MS'],
    ['68', 'AC'], ['69', 'RO'], ['71', 'BA'], ['79', 'SE'], ['81', 'PE'],
    ['82', 'AL'], ['83', 'PB'], ['84', 'RN'], ['85', 'CE'], ['86', 'PI'],
    ['91', 'PA'], ['97', 'AM'], ['95', 'RR'], ['96', 'AP'], ['99', 'MA'],
  ];
  for (const [ddd, uf] of cases) {
    assert.equal(getCommWhatsAppPhoneRegion(`55${ddd}999999999`)?.uf, uf, ddd);
  }
  assert.equal(getCommWhatsAppPhoneRegion('5561999999999')?.name, 'Distrito Federal e Goiás');
});

test('não atribui estado a identificadores privados, números estrangeiros ou inválidos', () => {
  for (const phone of [
    null, undefined, '', '12345@lid', '5521969263786@s.whatsapp.net',
    '5521969263786@c.us', '5521969263786@g.us', '+1 (212) 555-1234',
    '+33 1 23 45 67 89', '442079460958', '5520999999999', '559999999',
    '08001234567', '5521123456789', 'telefone: 5521969263786',
  ]) {
    assert.equal(getCommWhatsAppPhoneRegion(phone), null, String(phone));
  }
});
