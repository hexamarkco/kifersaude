import { supabaseAdmin } from '../lib/supabaseAdmin';
import { sendWhatsappMedia, sendWhatsappMessage } from '../lib/whatsappApi';
import type {
  CampaignSendResult,
  WhatsappCampaign,
  WhatsappCampaignStep,
  WhatsappCampaignTarget,
  WhatsappCampaignTargetConditionState,
} from '../types/whatsappCampaigns';

const DEFAULT_WAIT_SECONDS = 60;

type TargetRecord = WhatsappCampaignTarget & {
  campaign: Pick<WhatsappCampaign, 'id' | 'status' | 'name'>;
};

type ProcessOptions = {
  limit?: number;
  now?: Date;
  fetchImpl?: typeof fetch;
};

const STEP_TYPES = {
  MESSAGE: 'message',
  ATTACHMENT: 'attachment',
  WAIT: 'wait_condition',
} as const;

const MEDIA_ENDPOINT_MAP: Record<string, string> = {
  document: '/whatsapp-webhook/send-document',
  image: '/whatsapp-webhook/send-image',
  video: '/whatsapp-webhook/send-video',
  audio: '/whatsapp-webhook/send-audio',
};

const getIsoString = (value: Date) => value.toISOString();

export class WhatsappCampaignService {
  private stepCache = new Map<string, WhatsappCampaignStep[]>();

  constructor(private readonly defaultFetch: typeof fetch = fetch) {}

  private async loadSteps(campaignId: string): Promise<WhatsappCampaignStep[]> {
    if (this.stepCache.has(campaignId)) {
      return this.stepCache.get(campaignId)!;
    }

    const { data, error } = await supabaseAdmin
      .from('whatsapp_campaign_steps')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('order_index', { ascending: true });

    if (error) {
      throw error;
    }

    const steps = (data ?? []) as WhatsappCampaignStep[];
    this.stepCache.set(campaignId, steps);
    return steps;
  }

  private async updateTarget(id: string, payload: Partial<WhatsappCampaignTarget>) {
    const { error } = await supabaseAdmin
      .from('whatsapp_campaign_targets')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  private async markTargetAsFailed(target: TargetRecord, message: string) {
    await this.updateTarget(target.id, {
      status: 'failed',
      last_error: message,
      wait_until: null,
      condition_state: null,
    });
  }

  private async advanceTarget(
    target: TargetRecord,
    steps: WhatsappCampaignStep[],
    now: Date,
  ): Promise<CampaignSendResult> {
    const nextIndex = target.current_step_index + 1;
    const isFinished = nextIndex >= steps.length;
    await this.updateTarget(target.id, {
      current_step_index: nextIndex,
      status: isFinished ? 'completed' : 'in_progress',
      wait_until: null,
      condition_state: null,
      last_execution_at: getIsoString(now),
      last_error: null,
    });

    return {
      targetId: target.id,
      status: isFinished ? 'sent' : 'waiting',
    };
  }

  private needsWaiting(target: TargetRecord, now: Date): boolean {
    if (target.status !== 'waiting') {
      return false;
    }

    if (!target.wait_until) {
      return true;
    }

    const waitDate = new Date(target.wait_until);
    return Number.isNaN(waitDate.getTime()) || waitDate.getTime() > now.getTime();
  }

  private normalizeConditionState(
    raw: WhatsappCampaignTarget['condition_state'],
  ): WhatsappCampaignTargetConditionState | null {
    if (!raw) {
      return null;
    }

    if (typeof raw !== 'object') {
      return null;
    }

    const { type, startedAt, timeoutSeconds } = raw as WhatsappCampaignTargetConditionState;
    if (!type || !startedAt) {
      return null;
    }

    return {
      type,
      startedAt,
      timeoutSeconds,
    };
  }

  private async handleWaitStep(
    target: TargetRecord,
    step: WhatsappCampaignStep,
    steps: WhatsappCampaignStep[],
    now: Date,
  ): Promise<CampaignSendResult> {
    const waitConfig = step.config?.wait ?? { strategy: 'duration', durationSeconds: DEFAULT_WAIT_SECONDS };
    const strategy = waitConfig.strategy ?? 'duration';
    const durationSeconds = waitConfig.durationSeconds ?? DEFAULT_WAIT_SECONDS;
    const nowIso = getIsoString(now);

    if (strategy === 'duration') {
      if (!target.wait_until) {
        const waitUntil = new Date(now.getTime() + durationSeconds * 1000);
        await this.updateTarget(target.id, {
          status: 'waiting',
          wait_until: waitUntil.toISOString(),
          condition_state: {
            type: 'duration',
            startedAt: nowIso,
          },
        });
        return { targetId: target.id, status: 'waiting' };
      }

      if (new Date(target.wait_until).getTime() <= now.getTime()) {
        return this.advanceTarget(target, steps, now);
      }

      return { targetId: target.id, status: 'waiting' };
    }

    const conditionState = this.normalizeConditionState(target.condition_state);

    if (!target.chat_id) {
      // sem chat associado, converte espera em temporizador padrão
      return this.advanceTarget(target, steps, now);
    }

    if (!conditionState) {
      const waitUntil = waitConfig.timeoutSeconds
        ? new Date(now.getTime() + waitConfig.timeoutSeconds * 1000).toISOString()
        : null;

      await this.updateTarget(target.id, {
        status: 'waiting',
        wait_until: waitUntil,
        condition_state: {
          type: 'reply',
          startedAt: nowIso,
          timeoutSeconds: waitConfig.timeoutSeconds,
        },
      });

      return { targetId: target.id, status: 'waiting' };
    }

    const { data, error } = await supabaseAdmin
      .from('whatsapp_messages')
      .select('id')
      .eq('chat_id', target.chat_id)
      .eq('from_me', false)
      .gte('moment', conditionState.startedAt)
      .limit(1);

    if (error) {
      throw error;
    }

    const hasReply = Boolean(data && data.length > 0);
    if (hasReply) {
      return this.advanceTarget(target, steps, now);
    }

    if (target.wait_until) {
      const waitLimit = new Date(target.wait_until);
      if (!Number.isNaN(waitLimit.getTime()) && waitLimit.getTime() <= now.getTime()) {
        return this.advanceTarget(target, steps, now);
      }
    }

    return { targetId: target.id, status: 'waiting' };
  }

  private async handleAttachmentStep(
    target: TargetRecord,
    step: WhatsappCampaignStep,
    steps: WhatsappCampaignStep[],
    now: Date,
    fetchImpl: typeof fetch,
  ): Promise<CampaignSendResult> {
    const attachmentConfig = step.config?.attachment;
    if (!attachmentConfig) {
      throw new Error('Configuração de anexo não encontrada.');
    }

    const endpoint = MEDIA_ENDPOINT_MAP[attachmentConfig.attachmentType];
    if (!endpoint) {
      throw new Error(`Tipo de anexo não suportado: ${attachmentConfig.attachmentType}`);
    }

    const payload: Record<string, unknown> = {
      phone: target.phone,
    };

    if (attachmentConfig.attachmentType === 'document') {
      payload.document = attachmentConfig.payload;
      payload.fileName = attachmentConfig.fileName ?? undefined;
      payload.caption = attachmentConfig.caption ?? undefined;
    } else if (attachmentConfig.attachmentType === 'image') {
      payload.image = attachmentConfig.payload;
      payload.caption = attachmentConfig.caption ?? undefined;
    } else if (attachmentConfig.attachmentType === 'video') {
      payload.video = attachmentConfig.payload;
      payload.caption = attachmentConfig.caption ?? undefined;
    } else if (attachmentConfig.attachmentType === 'audio') {
      payload.audio = attachmentConfig.payload;
      payload.mimeType = attachmentConfig.mimeType ?? undefined;
    }

    await sendWhatsappMedia({ endpoint, body: payload }, { fetchImpl, useServiceKey: true });
    return this.advanceTarget(target, steps, now);
  }

  private async handleMessageStep(
    target: TargetRecord,
    step: WhatsappCampaignStep,
    steps: WhatsappCampaignStep[],
    now: Date,
    fetchImpl: typeof fetch,
  ): Promise<CampaignSendResult> {
    const messageText = step.config?.message?.body?.trim();
    if (!messageText) {
      throw new Error('Mensagem não configurada.');
    }

    await sendWhatsappMessage(
      { phone: target.phone, message: messageText },
      { fetchImpl, useServiceKey: true },
    );

    return this.advanceTarget(target, steps, now);
  }

  private async processTarget(
    target: TargetRecord,
    steps: WhatsappCampaignStep[],
    now: Date,
    fetchImpl: typeof fetch,
  ): Promise<CampaignSendResult> {
    if (steps.length === 0) {
      await this.updateTarget(target.id, {
        status: 'completed',
        last_execution_at: getIsoString(now),
        last_error: null,
      });
      return { targetId: target.id, status: 'sent' };
    }

    const currentStep = steps[target.current_step_index] ?? null;
    if (!currentStep) {
      return this.advanceTarget(target, steps, now);
    }

    if (this.needsWaiting(target, now)) {
      return { targetId: target.id, status: 'waiting' };
    }

    switch (currentStep.step_type) {
      case STEP_TYPES.MESSAGE:
        return this.handleMessageStep(target, currentStep, steps, now, fetchImpl);
      case STEP_TYPES.ATTACHMENT:
        return this.handleAttachmentStep(target, currentStep, steps, now, fetchImpl);
      case STEP_TYPES.WAIT:
        return this.handleWaitStep(target, currentStep, steps, now);
      default:
        throw new Error(`Tipo de passo não suportado: ${currentStep.step_type}`);
    }
  }

  async processPendingTargets(options: ProcessOptions = {}): Promise<CampaignSendResult[]> {
    const now = options.now ?? new Date();
    const fetcher = options.fetchImpl ?? this.defaultFetch;
    const limit = options.limit ?? 25;

    const { data, error } = await supabaseAdmin
      .from('whatsapp_campaign_targets')
      .select('*, campaign:whatsapp_campaigns!inner(id, status, name)')
      .in('status', ['pending', 'in_progress', 'waiting'])
      .order('updated_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }

    const targets = ((data ?? []) as TargetRecord[]).filter(record => record.campaign.status === 'running');
    if (targets.length === 0) {
      return [];
    }

    const results: CampaignSendResult[] = [];

    for (const target of targets) {
      try {
        const steps = await this.loadSteps(target.campaign_id);
        const result = await this.processTarget(target, steps, now, fetcher);
        results.push(result);
      } catch (processingError) {
        const normalizedError =
          processingError instanceof Error ? processingError.message : String(processingError);
        await this.markTargetAsFailed(target, normalizedError);
        results.push({ targetId: target.id, status: 'failed', error: normalizedError });
      }
    }

    return results;
  }
}

export const whatsappCampaignService = new WhatsappCampaignService();
