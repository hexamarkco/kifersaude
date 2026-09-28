import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

import { configService, type IntegrationSetting } from '../../../config';
import { toast } from '../../../../lib/toast';
import {
  WHATSAPP_QUICK_REPLIES_INTEGRATION_DESCRIPTION,
  WHATSAPP_QUICK_REPLIES_INTEGRATION_NAME,
  WHATSAPP_QUICK_REPLIES_INTEGRATION_SLUG,
  buildWhatsAppQuickRepliesSettings,
  normalizeWhatsAppQuickRepliesSettings,
  type WhatsAppQuickReply,
} from '../domain/quickReplies';

const DEFAULT_QUICK_REPLIES = normalizeWhatsAppQuickRepliesSettings(null).quickReplies;

export const useInboxQuickReplies = ({
  setDismissedQuickReplyKey,
}: {
  setDismissedQuickReplyKey: Dispatch<SetStateAction<string | null>>;
}) => {
  const [quickReplyIntegration, setQuickReplyIntegration] = useState<IntegrationSetting | null>(null);
  const [quickReplies, setQuickReplies] = useState<WhatsAppQuickReply[]>(DEFAULT_QUICK_REPLIES);
  const [loadError, setLoadError] = useState(false);
  const [loadRetryToken, setLoadRetryToken] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const loadRequestIdRef = useRef(0);
  const saveRequestIdRef = useRef(0);

  useEffect(() => {
    let active = true;
    const requestId = ++loadRequestIdRef.current;
    setLoadError(false);

    void configService
      .getIntegrationSetting(WHATSAPP_QUICK_REPLIES_INTEGRATION_SLUG)
      .then((integration) => {
        if (!active || requestId !== loadRequestIdRef.current) {
          return;
        }

        const normalized = normalizeWhatsAppQuickRepliesSettings(integration?.settings);
        setQuickReplyIntegration(integration);
        setQuickReplies(normalized.quickReplies);
        setLoadError(false);
      })
      .catch((error) => {
        console.error('[WhatsAppInbox] erro ao carregar mensagens rápidas', error);
        if (active && requestId === loadRequestIdRef.current) {
          setQuickReplyIntegration(null);
          setQuickReplies([]);
          setLoadError(true);
        }
      });

    return () => {
      active = false;
      loadRequestIdRef.current += 1;
    };
  }, [loadRetryToken]);

  useEffect(() => () => {
    saveRequestIdRef.current += 1;
    loadRequestIdRef.current += 1;
  }, []);

  const retryLoad = useCallback(() => {
    setLoadRetryToken((current) => current + 1);
  }, []);

  const openSettings = useCallback(() => {
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    saveRequestIdRef.current += 1;
    setSaving(false);
    setSettingsOpen(false);
  }, []);

  const saveQuickReplies = useCallback(async (nextQuickReplies: WhatsAppQuickReply[]) => {
    if (saving) {
      return;
    }

    loadRequestIdRef.current += 1;
    const requestId = ++saveRequestIdRef.current;
    setSaving(true);

    try {
      const settingsPayload = buildWhatsAppQuickRepliesSettings(nextQuickReplies);
      const result = quickReplyIntegration?.id
        ? await configService.updateIntegrationSetting(quickReplyIntegration.id, {
            settings: settingsPayload,
          })
        : await configService.createIntegrationSetting({
            slug: WHATSAPP_QUICK_REPLIES_INTEGRATION_SLUG,
            name: WHATSAPP_QUICK_REPLIES_INTEGRATION_NAME,
            description: WHATSAPP_QUICK_REPLIES_INTEGRATION_DESCRIPTION,
            settings: settingsPayload,
          });

      if (result.error) {
        throw result.error;
      }

      if (requestId !== saveRequestIdRef.current) {
        return;
      }

      const savedIntegration = result.data ?? quickReplyIntegration;
      const normalized = normalizeWhatsAppQuickRepliesSettings(savedIntegration?.settings ?? settingsPayload);

      setQuickReplyIntegration(savedIntegration);
      setQuickReplies(normalized.quickReplies);
      setSettingsOpen(false);
      setDismissedQuickReplyKey(null);
      toast.success('Mensagens rápidas salvas com sucesso.');
    } catch (error) {
      if (requestId !== saveRequestIdRef.current) {
        return;
      }

      console.error('[WhatsAppInbox] erro ao salvar mensagens rápidas', error);
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar as mensagens rápidas.');
    } finally {
      if (requestId === saveRequestIdRef.current) {
        setSaving(false);
      }
    }
  }, [quickReplyIntegration, saving, setDismissedQuickReplyKey]);

  return {
    quickReplies,
    loadError,
    retryLoad,
    settingsOpen,
    saving,
    openSettings,
    closeSettings,
    saveQuickReplies,
  };
};
