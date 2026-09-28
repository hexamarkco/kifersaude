import { useCallback } from 'react';

import {
  approveInboxFollowUpSchedule,
  clearInboxLeadAgenda,
  insertInboxLegacyFollowUpAudits,
  markInboxRemindersRead,
  scheduleInboxFollowUp,
  updateInboxFollowUpSentAudits,
  whatsappContactsRepository,
  whatsappMessagesRepository,
} from '../data';
import type { CommWhatsAppChat } from '../domain/types';
import { resolveBatchFollowUpFinalStatus } from '../domain/batchFollowUpOutcome';
import type {
  BatchFollowUpSendItem,
  BatchFollowUpSendOptions,
  BatchFollowUpSendSummary,
} from '../domain/batchFollowUpTypes';
import { normalizeWhapiDirectChatId } from '../whatsAppChatId';
import { toast } from '../../../../lib/toast';

type CurrentValue<Value> = { readonly current: Value };
type MessageLoadReason = 'initial' | 'poll' | 'send';

type InboxBatchFollowUpSenderOptions = {
  refs: {
    latestChatsRef: CurrentValue<CommWhatsAppChat[]>;
    loadChatsRef: CurrentValue<() => Promise<unknown> | void>;
    loadMessagesRef: CurrentValue<(chat: CommWhatsAppChat | null, reason?: MessageLoadReason) => Promise<unknown> | void>;
  };
};

export const useInboxBatchFollowUpSender = ({ refs }: InboxBatchFollowUpSenderOptions) => {
  const { latestChatsRef, loadChatsRef, loadMessagesRef } = refs;

  const handleBatchSendFollowUp = useCallback(async (
    results: BatchFollowUpSendItem[],
    options?: BatchFollowUpSendOptions,
  ): Promise<BatchFollowUpSendSummary> => {
    const chats = latestChatsRef.current;
    const sentIds: string[] = [];
    const failures: string[] = [];
    const warnings: string[] = [];
    const approvedSchedules: Array<{
      leadId: string;
      generationId: string | null;
      sourceReminderId: string;
      dueAt: string;
      reason: string | null;
    }> = [];
    const statusUpdates = new Map<string, {
      chatId: string;
      leadId: string;
      status: 'Reativação' | 'Perdido';
      reminderId: string;
    }>();
    const resolvedReminderIds = new Set<string>();
    let waitWithoutScheduleCount = 0;
    const legacyAuditEntries: Array<{
      lead_id: string;
      chat_id: string;
      text_content: string;
      next_action_title: string | null;
      next_action_due_at: string | null;
    }> = [];

    for (const [index, result] of results.entries()) {
      const totalSegments = result.textSegments.length;
      const chat = chats.find((candidate) => candidate.id === result.chatId)
        ?? (result.externalChatId ? chats.find((candidate) => candidate.external_chat_id === result.externalChatId) : null)
        ?? chats.find((candidate) => candidate.lead_id === result.leadId);
      const finalStatus = resolveBatchFollowUpFinalStatus({
        approvedScheduleAction: result.approvedScheduleAction,
        approvedScheduleDate: result.approvedScheduleDate,
        opportunityRecommendation: result.opportunityRecommendation,
        currentLeadStatus: chat?.lead_status,
      });

      if (result.currentAction === 'wait') {
        if (result.approvedScheduleAction === 'schedule' && result.approvedScheduleDate) {
          approvedSchedules.push({
            leadId: result.leadId,
            generationId: result.generationId,
            sourceReminderId: result.reminderId,
            dueAt: result.approvedScheduleDate,
            reason: result.scheduleReason,
          });
          options?.onProgress?.({
            reminderId: result.reminderId,
            status: 'sent',
            sentSegments: 0,
            totalSegments: 0,
          });
        } else {
          waitWithoutScheduleCount += 1;
          if (finalStatus) {
            statusUpdates.set(result.leadId, {
              chatId: result.chatId,
              leadId: result.leadId,
              status: finalStatus,
              reminderId: result.reminderId,
            });
          } else {
            resolvedReminderIds.add(result.reminderId);
          }
          options?.onProgress?.({
            reminderId: result.reminderId,
            status: 'sent',
            sentSegments: 0,
            totalSegments: 0,
          });
        }
        continue;
      }

      options?.onProgress?.({
        reminderId: result.reminderId,
        status: 'sending',
        sentSegments: 0,
        totalSegments,
      });

      const phoneChatId = normalizeWhapiDirectChatId(result.phone);
      const externalChatId = normalizeWhapiDirectChatId(chat?.external_chat_id)
        || normalizeWhapiDirectChatId(result.externalChatId)
        || phoneChatId;

      if (chat?.identity_conflict) {
        const errorMessage = 'Identidade WhatsApp pendente de revisão manual.';
        failures.push(`Lead ${result.leadId}: ${errorMessage}`);
        options?.onProgress?.({
          reminderId: result.reminderId,
          status: 'failed',
          sentSegments: 0,
          totalSegments,
          errorMessage,
        });
        continue;
      }

      if (!externalChatId) {
        const errorMessage = 'Sem conversa externa ou telefone valido.';
        failures.push(`Lead ${result.leadId}: ${errorMessage}`);
        options?.onProgress?.({
          reminderId: result.reminderId,
          status: 'failed',
          sentSegments: 0,
          totalSegments,
          errorMessage,
        });
        continue;
      }

      if (result.textSegments.length === 0) {
        const errorMessage = 'Mensagem vazia.';
        failures.push(`Lead ${result.leadId}: ${errorMessage}`);
        options?.onProgress?.({
          reminderId: result.reminderId,
          status: 'failed',
          sentSegments: 0,
          totalSegments,
          errorMessage,
        });
        continue;
      }

      try {
        for (const [segmentIndex, segment] of result.textSegments.entries()) {
          await whatsappMessagesRepository.sendText(externalChatId, segment, {
            clientRequestId: `follow-up:${result.reminderId}:${segmentIndex}`,
          });
          options?.onProgress?.({
            reminderId: result.reminderId,
            status: 'sending',
            sentSegments: segmentIndex + 1,
            totalSegments,
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível enviar o follow-up.';
        failures.push(`Lead ${result.leadId}: ${message}`);
        options?.onProgress?.({
          reminderId: result.reminderId,
          status: 'failed',
          sentSegments: 0,
          totalSegments,
          errorMessage: message,
        });
        if (index < results.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
        continue;
      }

      sentIds.push(result.reminderId);
      if (!finalStatus) {
        if (result.approvedScheduleAction !== 'schedule' || !result.approvedScheduleDate) {
          resolvedReminderIds.add(result.reminderId);
        }
      } else {
        statusUpdates.set(result.leadId, {
          chatId: result.chatId,
          leadId: result.leadId,
          status: finalStatus,
          reminderId: result.reminderId,
        });
      }
      options?.onProgress?.({
        reminderId: result.reminderId,
        status: 'sent',
        sentSegments: totalSegments,
        totalSegments,
      });
      if (result.approvedScheduleAction === 'schedule' && result.approvedScheduleDate) {
        approvedSchedules.push({
          leadId: result.leadId,
          generationId: result.generationId,
          sourceReminderId: result.reminderId,
          dueAt: result.approvedScheduleDate,
          reason: result.scheduleReason,
        });
      }
      if (!result.generationId) {
        legacyAuditEntries.push({
          lead_id: result.leadId,
          chat_id: result.chatId,
          text_content: result.textSegments.join('\n\n'),
          next_action_title: null,
          next_action_due_at: result.approvedScheduleDate,
        });
      }
      if (index < results.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    if (sentIds.length === 0 && approvedSchedules.length === 0 && waitWithoutScheduleCount === 0) {
      throw new Error(failures[0] || 'Nenhum follow-up selecionado possui mensagem para enviar ou agenda aprovada.');
    }

    let scheduledCount = 0;
    for (const schedule of approvedSchedules) {
      const title = 'Follow-up';
      const description = schedule.reason || 'Lembrete aprovado após revisão do follow-up gerado por IA.';
      try {
        const scheduledReminder = await scheduleInboxFollowUp({
          leadId: schedule.leadId,
          title,
          description,
          dueAt: schedule.dueAt,
          priority: 'normal',
          generationId: schedule.generationId,
          origin: 'follow_up_v2_batch',
        });
        scheduledCount += 1;
        resolvedReminderIds.add(schedule.sourceReminderId);
        if (schedule.generationId) {
          try {
            await approveInboxFollowUpSchedule({
              generationId: schedule.generationId,
              dueAt: schedule.dueAt,
              reminderId: scheduledReminder.reminderId,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'erro desconhecido';
            warnings.push(`Lembrete criado, mas a proveniência não foi atualizada: ${message}`);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'erro desconhecido';
        warnings.push(`Erro ao agendar proximo follow-up para lead ${schedule.leadId}: ${message}`);
      }
    }

    for (const statusUpdate of statusUpdates.values()) {
      try {
        await whatsappContactsRepository.updateLeadStatus(statusUpdate.chatId, statusUpdate.status);
        if (statusUpdate.status === 'Perdido') {
          await clearInboxLeadAgenda(statusUpdate.leadId);
        }
        resolvedReminderIds.add(statusUpdate.reminderId);
        options?.onProgress?.({
          reminderId: statusUpdate.reminderId,
          status: 'sent',
          sentSegments: 0,
          totalSegments: 0,
          finalStatus: statusUpdate.status,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'erro desconhecido';
        warnings.push(`Follow-up concluído, mas não foi possível mover o lead ${statusUpdate.leadId} para ${statusUpdate.status}: ${message}`);
      }
    }

    try {
      await markInboxRemindersRead([...resolvedReminderIds]);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'erro desconhecido';
      warnings.push(`Erro ao marcar lembretes como lidos: ${message}`);
    }

    const sentAtActual = new Date().toISOString();
    const generatedAuditUpdates = results
      .filter((result) => sentIds.includes(result.reminderId) && result.generationId)
      .map((result) => ({ id: result.generationId as string, sentText: result.textSegments.join('\n\n') }));
    if (generatedAuditUpdates.length > 0) {
      try {
        await updateInboxFollowUpSentAudits(generatedAuditUpdates, sentAtActual);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'erro desconhecido';
        warnings.push(`Follow-ups enviados, mas a auditoria V2 não foi atualizada: ${message}`);
      }
    }

    if (legacyAuditEntries.length > 0) {
      try {
        await insertInboxLegacyFollowUpAudits(legacyAuditEntries);
      } catch (auditError) {
        console.error('[WhatsAppInbox] erro ao registrar auditoria', auditError);
        warnings.push('Follow-ups enviados, mas não foi possível registrar a auditoria.');
      }
    }

    void Promise.all([loadChatsRef.current(), loadMessagesRef.current(null, 'send')]).catch((refreshError) => {
      console.error('[WhatsAppInbox] erro ao atualizar conversas apos envio batch', refreshError);
      toast.warning('Follow-ups enviados, mas houve um erro ao atualizar a lista. Atualize a página se necessário.');
    });

    const message = `${sentIds.length} follow-up(s) enviado(s)${scheduledCount > 0 ? ` e ${scheduledCount} novo(s) agendado(s)` : ''}.`;
    if (failures.length > 0) {
      toast.warning(`${message} ${failures.length} falharam.`);
    } else if (warnings.length > 0) {
      toast.warning(message);
    } else {
      toast.success(message);
    }

    return {
      sentCount: sentIds.length,
      scheduledCount,
      failedCount: failures.length,
      errorMessage: [...failures, ...warnings].slice(0, 3).join('\n') || undefined,
    };
  }, [latestChatsRef, loadChatsRef, loadMessagesRef]);

  return { handleBatchSendFollowUp };
};
