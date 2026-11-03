import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.57.4';
import { archiveCommWhatsAppMedia, readCommWhatsAppMediaBlob } from '../comm-whatsapp.ts';
import { isPlausibleMediaSignature, type MediaFileKind } from '../file-signature.ts';

declare const Deno: { env: { get(key: string): string | undefined } };

export function isTrustedZapiMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const origins = (Deno.env.get('ZAPI_MEDIA_ORIGINS') ?? '').split(',').map((item) => item.trim());
    return url.protocol === 'https:' && !url.username && !url.password && origins.includes(url.origin);
  } catch {
    return false;
  }
}

export async function archiveZapiMedia(
  admin: SupabaseClient,
  id: string,
  media: { url: string; mimeType: string; type: string },
) {
  if (!isTrustedZapiMediaUrl(media.url)) throw new Error('Origem de arquivo da Z-API ainda não autorizada.');
  const response = await fetch(media.url, { redirect: 'error', signal: AbortSignal.timeout(15_000) })
    .catch(() => { throw new Error('O arquivo da Z-API está indisponível.'); });
  if (!response.ok) throw new Error('O arquivo da Z-API está indisponível.');
  const blob = await readCommWhatsAppMediaBlob(response);
  const declaredMime = media.mimeType.split(';')[0].trim().toLowerCase() || blob.type.split(';')[0].trim().toLowerCase();
  const kind = (media.type === 'sticker' ? 'image' : media.type === 'gif' ?
    (declaredMime.startsWith('video/') ? 'video' : 'image') : media.type) as MediaFileKind;
  const allowedMime = /^(image\/(jpeg|png|gif|webp|bmp)|audio\/[a-z0-9.+-]+|video\/[a-z0-9.+-]+|application\/(pdf|zip|vnd\.[a-z0-9.+-]+)|text\/(plain|csv))$/;
  const mimeType = allowedMime.test(declaredMime) ? declaredMime : 'application/octet-stream';
  const header = new Uint8Array(await blob.slice(0, 1024).arrayBuffer());
  if (!blob.size || !isPlausibleMediaSignature(kind, header)) {
    throw new Error('O conteúdo do arquivo da Z-API não corresponde ao formato esperado.');
  }
  await archiveCommWhatsAppMedia(admin, { mediaId: id, blob, mimeType });
  return mimeType;
}
