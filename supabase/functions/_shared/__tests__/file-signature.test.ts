import assert from 'node:assert/strict';
import { test } from 'vitest';

import { isPlausibleMediaSignature } from '../file-signature';

const bytes = (...values: number[]): Uint8Array => new Uint8Array(values);
const asciiBytes = (text: string, padTo = 16): Uint8Array => {
  const arr = new Uint8Array(padTo);
  for (let i = 0; i < text.length; i += 1) arr[i] = text.charCodeAt(i);
  return arr;
};

test('imagem: aceita assinaturas reais de JPEG/PNG/GIF/WEBP/BMP', () => {
  assert.equal(isPlausibleMediaSignature('image', bytes(0xff, 0xd8, 0xff, 0xe0)), true);
  assert.equal(isPlausibleMediaSignature('image', bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), true);
  assert.equal(isPlausibleMediaSignature('image', bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61)), true);
  assert.equal(isPlausibleMediaSignature('image', asciiBytes('RIFF....WEBP')), true);
  assert.equal(isPlausibleMediaSignature('image', bytes(0x42, 0x4d, 0, 0)), true);
});

test('imagem: rejeita um executável disfarçado de imagem (Content-Type forjado)', () => {
  // "MZ" — cabeçalho de executável Windows (PE)
  assert.equal(isPlausibleMediaSignature('image', bytes(0x4d, 0x5a, 0x90, 0x00)), false);
  // texto simples não é nenhuma assinatura de imagem conhecida
  assert.equal(isPlausibleMediaSignature('image', asciiBytes('not an image')), false);
});

test('vídeo: aceita mp4/mov (ftyp), webm e avi', () => {
  const mp4 = new Uint8Array(12);
  'ftyp'.split('').forEach((c, i) => (mp4[4 + i] = c.charCodeAt(0)));
  assert.equal(isPlausibleMediaSignature('video', mp4), true);
  assert.equal(isPlausibleMediaSignature('video', bytes(0x1a, 0x45, 0xdf, 0xa3)), true);
  assert.equal(isPlausibleMediaSignature('video', asciiBytes('RIFF....AVI ')), true);
});

test('vídeo: rejeita executável ELF disfarçado', () => {
  assert.equal(isPlausibleMediaSignature('video', bytes(0x7f, 0x45, 0x4c, 0x46)), false);
});

test('áudio/voice: aceita mp3 (com/sem ID3), ogg, wav', () => {
  assert.equal(isPlausibleMediaSignature('audio', bytes(0xff, 0xfb, 0x90, 0x00)), true);
  assert.equal(isPlausibleMediaSignature('audio', asciiBytes('ID3.............')), true);
  assert.equal(isPlausibleMediaSignature('voice', asciiBytes('OggS............')), true);
  assert.equal(isPlausibleMediaSignature('voice', asciiBytes('RIFF....WAVE')), true);
});

test('áudio: rejeita script de shell disfarçado', () => {
  assert.equal(isPlausibleMediaSignature('audio', asciiBytes('#!/bin/sh\nrm -rf')), false);
});

test('documento: aceita formatos comuns (PDF) e qualquer coisa que não seja executável/script', () => {
  assert.equal(isPlausibleMediaSignature('document', asciiBytes('%PDF-1.7........')), true);
  // ZIP-based (docx/xlsx/pptx) — assinatura "PK"
  assert.equal(isPlausibleMediaSignature('document', bytes(0x50, 0x4b, 0x03, 0x04)), true);
  // CSV/TXT sem assinatura binária nenhuma — não é executável, deve passar
  assert.equal(isPlausibleMediaSignature('document', asciiBytes('nome,telefone\n')), true);
});

test('documento: rejeita executável Windows/Linux/macOS e script de shell disfarçados', () => {
  assert.equal(isPlausibleMediaSignature('document', bytes(0x4d, 0x5a, 0x90, 0x00)), false);
  assert.equal(isPlausibleMediaSignature('document', bytes(0x7f, 0x45, 0x4c, 0x46)), false);
  assert.equal(isPlausibleMediaSignature('document', bytes(0xfe, 0xed, 0xfa, 0xce)), false);
  assert.equal(isPlausibleMediaSignature('document', asciiBytes('#!/bin/bash\n')), false);
});

test('lida com buffers vazios ou menores que a assinatura sem lançar erro', () => {
  assert.equal(isPlausibleMediaSignature('image', new Uint8Array(0)), false);
  assert.equal(isPlausibleMediaSignature('document', new Uint8Array(0)), true);
  assert.equal(isPlausibleMediaSignature('image', bytes(0xff)), false);
});
