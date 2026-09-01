export type MediaFileKind = 'image' | 'video' | 'document' | 'audio' | 'voice';

const startsWithBytes = (bytes: Uint8Array, signature: number[], offset = 0): boolean => {
  if (bytes.length < offset + signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[offset + i] !== signature[i]) return false;
  }
  return true;
};

const matchesAscii = (bytes: Uint8Array, ascii: string, offset = 0): boolean =>
  startsWithBytes(bytes, Array.from(ascii, (char) => char.charCodeAt(0)), offset);

const isJpeg = (b: Uint8Array) => startsWithBytes(b, [0xff, 0xd8, 0xff]);
const isPng = (b: Uint8Array) => startsWithBytes(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isGif = (b: Uint8Array) => startsWithBytes(b, [0x47, 0x49, 0x46, 0x38]);
const isWebp = (b: Uint8Array) => matchesAscii(b, 'RIFF', 0) && matchesAscii(b, 'WEBP', 8);
const isBmp = (b: Uint8Array) => startsWithBytes(b, [0x42, 0x4d]);

// ISO base media file format (mp4/mov/m4a/m4v/3gp) sempre tem "ftyp" a partir do byte 4.
const isIsoBaseMedia = (b: Uint8Array) => matchesAscii(b, 'ftyp', 4);
const isWebm = (b: Uint8Array) => startsWithBytes(b, [0x1a, 0x45, 0xdf, 0xa3]);
const isAvi = (b: Uint8Array) => matchesAscii(b, 'RIFF', 0) && matchesAscii(b, 'AVI ', 8);

const isMp3 = (b: Uint8Array) =>
  startsWithBytes(b, [0xff, 0xfb]) || startsWithBytes(b, [0xff, 0xf3]) || startsWithBytes(b, [0xff, 0xf2]) || matchesAscii(b, 'ID3', 0);
const isOgg = (b: Uint8Array) => matchesAscii(b, 'OggS', 0);
const isWav = (b: Uint8Array) => matchesAscii(b, 'RIFF', 0) && matchesAscii(b, 'WAVE', 8);

const isWindowsExecutable = (b: Uint8Array) => startsWithBytes(b, [0x4d, 0x5a]); // "MZ"
const isElfExecutable = (b: Uint8Array) => startsWithBytes(b, [0x7f, 0x45, 0x4c, 0x46]); // "\x7fELF"
const isMachOExecutable = (b: Uint8Array) =>
  startsWithBytes(b, [0xfe, 0xed, 0xfa, 0xce]) ||
  startsWithBytes(b, [0xfe, 0xed, 0xfa, 0xcf]) ||
  startsWithBytes(b, [0xcf, 0xfa, 0xed, 0xfe]) ||
  startsWithBytes(b, [0xce, 0xfa, 0xed, 0xfe]);
const isShellScript = (b: Uint8Array) => matchesAscii(b, '#!', 0);

/**
 * Valida os primeiros bytes de um upload contra o tipo de mídia declarado, para
 * detectar um `Content-Type` forjado (ex.: um executável enviado como
 * `image/png`). Para imagem/vídeo/áudio, valida por allowlist das assinaturas
 * reais mais comuns. Para documento — categoria propositalmente ampla (PDF,
 * DOCX, XLSX, ZIP, TXT, CSV...) — usa blocklist: só rejeita assinaturas
 * conhecidas de executável/script, para não gerar falsos positivos em formatos
 * de documento legítimos e menos comuns.
 */
export function isPlausibleMediaSignature(kind: MediaFileKind, bytes: Uint8Array): boolean {
  switch (kind) {
    case 'image':
      return isJpeg(bytes) || isPng(bytes) || isGif(bytes) || isWebp(bytes) || isBmp(bytes);
    case 'video':
      return isIsoBaseMedia(bytes) || isWebm(bytes) || isAvi(bytes);
    case 'audio':
    case 'voice':
      // O MediaRecorder gera audio/webm (EBML) em Chrome/Edge quando OGG não
      // está disponível. WebM também pode conter vídeo, mas continua sendo um
      // contêiner de mídia válido — a Whapi valida o codec/stream ao receber.
      return isMp3(bytes) || isOgg(bytes) || isWav(bytes) || isIsoBaseMedia(bytes) || isWebm(bytes);
    case 'document':
    default:
      return !(isWindowsExecutable(bytes) || isElfExecutable(bytes) || isMachOExecutable(bytes) || isShellScript(bytes));
  }
}
