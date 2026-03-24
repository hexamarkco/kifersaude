import { supabase } from './supabase';

export const WHATSAPP_CAMPAIGN_IMPORT_BUCKET = 'whatsapp-campaign-imports';

type UploadResult = {
  bucket: string;
  path: string;
};

const sanitizeFileName = (name: string): string =>
  name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 120);

export async function uploadWhatsAppCampaignImportFile(fileName: string, rawText: string): Promise<UploadResult> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const safeFileName = sanitizeFileName(fileName || `campaign-${timestamp}.csv`) || `campaign-${timestamp}.csv`;
  const path = `${year}/${month}/${timestamp}-${random}-${safeFileName}`;
  const file = new File([rawText], safeFileName, { type: 'text/csv;charset=utf-8' });

  const { data, error } = await supabase.storage
    .from(WHATSAPP_CAMPAIGN_IMPORT_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: 'text/csv; charset=utf-8',
      upsert: false,
    });

  if (error || !data) {
    throw new Error(error?.message || 'Falha ao enviar CSV para o storage.');
  }

  return {
    bucket: WHATSAPP_CAMPAIGN_IMPORT_BUCKET,
    path: data.path,
  };
}

export async function deleteWhatsAppCampaignImportFile(path: string): Promise<void> {
  if (!path) {
    return;
  }

  const { error } = await supabase.storage.from(WHATSAPP_CAMPAIGN_IMPORT_BUCKET).remove([path]);
  if (error) {
    throw error;
  }
}
