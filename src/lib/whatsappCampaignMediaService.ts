import { supabase } from './supabase';
import type { WhatsAppCampaignFlowStepType } from '../types/whatsappCampaigns';

export const WHATSAPP_CAMPAIGN_MEDIA_BUCKET = 'whatsapp-campaign-media';
const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024;

type UploadResult = {
  success: boolean;
  url?: string;
  path?: string;
  filename?: string;
  error?: string;
};

const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
]);

const isFileAllowedForStepType = (stepType: WhatsAppCampaignFlowStepType, file: File): boolean => {
  if (stepType === 'text') {
    return false;
  }

  const mimeType = (file.type || '').toLowerCase();

  if (stepType === 'image') {
    return mimeType.startsWith('image/');
  }

  if (stepType === 'video') {
    return mimeType.startsWith('video/');
  }

  if (stepType === 'audio') {
    return mimeType.startsWith('audio/');
  }

  if (stepType === 'document') {
    if (DOCUMENT_MIME_TYPES.has(mimeType)) {
      return true;
    }

    const extension = file.name.toLowerCase().split('.').pop() || '';
    return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(extension);
  }

  return false;
};

const sanitizeFileName = (name: string): string => {
  return name
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9._-]/g, '')
    .slice(0, 120);
};

export const getAcceptedFileTypesByStepType = (stepType: WhatsAppCampaignFlowStepType): string => {
  if (stepType === 'image') {
    return 'image/*';
  }

  if (stepType === 'video') {
    return 'video/*';
  }

  if (stepType === 'audio') {
    return 'audio/*';
  }

  if (stepType === 'document') {
    return '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  return '';
};

export async function uploadWhatsAppCampaignMedia(
  stepType: WhatsAppCampaignFlowStepType,
  file: File,
): Promise<UploadResult> {
  if (stepType === 'text') {
    return {
      success: false,
      error: 'Etapas de texto nao aceitam upload de arquivo.',
    };
  }

  if (!isFileAllowedForStepType(stepType, file)) {
    return {
      success: false,
      error: `Tipo de arquivo invalido para etapa ${stepType}.`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      success: false,
      error: 'Arquivo muito grande. Limite maximo de 30MB por arquivo.',
    };
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const safeFileName = sanitizeFileName(file.name || `${stepType}-${timestamp}`);
  const objectPath = `${year}/${month}/${stepType}/${timestamp}-${random}-${safeFileName}`;

  try {
    const { data, error } = await supabase.storage
      .from(WHATSAPP_CAMPAIGN_MEDIA_BUCKET)
      .upload(objectPath, file, {
        cacheControl: '31536000',
        upsert: false,
      });

    if (error || !data) {
      return {
        success: false,
        error: error?.message || 'Falha ao enviar arquivo para o storage.',
      };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(WHATSAPP_CAMPAIGN_MEDIA_BUCKET).getPublicUrl(data.path);

    return {
      success: true,
      url: publicUrl,
      path: data.path,
      filename: file.name,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro inesperado no upload do arquivo.',
    };
  }
}
