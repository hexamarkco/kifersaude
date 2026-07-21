import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  Info,
  RefreshCcw,
  Save,
  ShieldCheck,
} from "lucide-react";

import { configService } from "../../../../lib/configService";
import {
  AUTO_CONTACT_INTEGRATION_SLUG,
  normalizeAutoContactSettings,
  type AutoContactSettings,
} from "../../../../lib/autoContactService";
import { supabase, type IntegrationSetting } from "../../../../lib/supabase";
import { WhatsAppApiSkeleton } from "../../../../components/ui/panelSkeletons";
import { useAdaptiveLoading } from "../../../../hooks/useAdaptiveLoading";
import { PanelAdaptiveLoadingFrame } from "../../../../components/ui/panelLoading";
import { toast } from "../../../../lib/toast";
import {
  Alert,
  Button,
  Card,
  IconButton,
  Input,
  Switch,
} from "../../../../design-system";

type MessageState = { type: "success" | "error"; text: string } | null;
type ChannelAdminState = {
  channel: {
    connection_status?: string | null;
    phone_number?: string | null;
    last_health_check_at?: string | null;
  };
  config: {
    tokenConfigured?: boolean;
    webhookUrl?: string;
  };
};

export default function WhatsAppApiSettingsPanel() {
  const [autoContactIntegration, setAutoContactIntegration] =
    useState<IntegrationSetting | null>(null);
  const [autoContactSettings, setAutoContactSettings] =
    useState<AutoContactSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const [statusMessage, setStatusMessage] = useState<MessageState>(null);
  const loadingUi = useAdaptiveLoading(loading);

  const [enabled, setEnabled] = useState(false);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [channelStatus, setChannelStatus] = useState("unknown");
  const [channelPhone, setChannelPhone] = useState("");

  const loadChannelState = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("comm-whatsapp-admin", {
      body: { action: "getConfig" },
    });

    if (error) {
      throw error;
    }

    const payload = (data ?? {}) as ChannelAdminState;
    setTokenConfigured(payload.config?.tokenConfigured === true);
    setWebhookUrl(payload.config?.webhookUrl?.trim() || "");
    setChannelStatus(payload.channel?.connection_status?.trim() || "unknown");
    setChannelPhone(payload.channel?.phone_number?.trim() || "");
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setStatusMessage(null);

    try {
      const [integration] = await Promise.all([
        configService.getIntegrationSetting(AUTO_CONTACT_INTEGRATION_SLUG),
        loadChannelState(),
      ]);
      const normalized = normalizeAutoContactSettings(integration?.settings);

      setAutoContactIntegration(integration);
      setAutoContactSettings(normalized);

      setEnabled(normalized.enabled);
    } catch (error) {
      console.error("[WhatsAppApiSettings] Error loading settings:", error);
      setStatusMessage({
        type: "error",
        text: "Erro ao carregar configurações.",
      });
    } finally {
      setLoading(false);
    }
  }, [loadChannelState]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    if (!autoContactIntegration) {
      setStatusMessage({
        type: "error",
        text: "Integração de automação não configurada.",
      });
      return;
    }

    setSaving(true);
    setStatusMessage(null);

    const currentMessageTemplates = autoContactSettings?.messageTemplates || [];
    const fallbackSettings = normalizeAutoContactSettings(
      autoContactIntegration.settings,
    );
    const currentFlows = autoContactSettings?.flows || fallbackSettings.flows;
    const currentScheduling =
      autoContactSettings?.scheduling || fallbackSettings.scheduling;
    const currentMonitoring =
      autoContactSettings?.monitoring || fallbackSettings.monitoring;
    const currentLogging =
      autoContactSettings?.logging || fallbackSettings.logging;
    const currentAutoSend =
      autoContactSettings?.autoSend ?? fallbackSettings.autoSend;

    const newSettings = {
      enabled,
      autoSend: currentAutoSend,
      messageTemplates: currentMessageTemplates,
      flows: currentFlows,
      scheduling: currentScheduling,
      monitoring: currentMonitoring,
      logging: currentLogging,
    };

    const { data, error } = await configService.updateIntegrationSetting(
      autoContactIntegration.id,
      {
        settings: newSettings,
      },
    );

    if (error) {
      setStatusMessage({
        type: "error",
        text: "Erro ao salvar a configuração. Tente novamente.",
      });
    } else {
      const updatedIntegration = data ?? autoContactIntegration;
      const normalized = normalizeAutoContactSettings(
        updatedIntegration.settings,
      );

      setAutoContactIntegration(updatedIntegration);
      setAutoContactSettings(normalized);
      setEnabled(normalized.enabled);
      await loadChannelState();

      setStatusMessage({
        type: "success",
        text: "Configuração salva com sucesso.",
      });
    }

    setSaving(false);
  };

  const handleRefreshHealth = async () => {
    setRefreshingHealth(true);

    try {
      const { data, error } = await supabase.functions.invoke("comm-whatsapp-admin", {
        body: { action: "refreshHealth" },
      });

      if (error) {
        throw error;
      }

      const payload = (data ?? {}) as ChannelAdminState;
      setWebhookUrl(payload.config?.webhookUrl?.trim() || "");
      setChannelStatus(payload.channel?.connection_status?.trim() || "unknown");
      setChannelPhone(payload.channel?.phone_number?.trim() || "");
      toast.success("Saúde do canal atualizada.");
    } catch (error) {
      console.error("[WhatsAppApiSettings] Error refreshing health:", error);
      toast.error("Nao foi possivel atualizar a saude do canal.");
    } finally {
      setRefreshingHealth(false);
    }
  };

  const handleCopyWebhook = async () => {
    if (!webhookUrl) return;

    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast.success("Webhook copiado para a area de transferencia.");
    } catch {
      toast.error("Nao foi possivel copiar o webhook agora.");
    }
  };

  if (!autoContactIntegration && !loading) {
    return (
      <Alert tone="warning">
        <div className="flex items-start gap-3">
        <Info className="mt-1 h-5 w-5" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold">
            Integração de automação não encontrada.
          </p>
          <p>Execute as migrações mais recentes para habilitar a integração.</p>
        </div>
        </div>
      </Alert>
    );
  }

  return (
    <PanelAdaptiveLoadingFrame
      loading={loading}
      phase={loadingUi.phase}
      hasContent={autoContactIntegration !== null}
      skeleton={<WhatsAppApiSkeleton />}
      stageLabel="Carregando configurações da API WhatsApp..."
      overlayLabel="Atualizando configurações da API WhatsApp..."
      stageClassName="min-h-[340px]"
    >
      <div className="space-y-6">
        {statusMessage && (
          <Alert tone={statusMessage.type === "success" ? "success" : "danger"}>
            <div className="flex items-center gap-3">
            {statusMessage.type === "success" ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <Info className="w-5 h-5" />
            )}
            <p>{statusMessage.text}</p>
            </div>
          </Alert>
        )}

        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-[var(--text-secondary)]">
            Como conectar um canal na Whapi Cloud
          </summary>
          <Alert tone="info" className="mt-3">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-2 text-sm">
                <p className="font-semibold">
                  Como obter seu token da Whapi Cloud:
                </p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>
                    Acesse{" "}
                    <a
                      href="https://whapi.cloud"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      whapi.cloud
                    </a>{" "}
                    e crie uma conta
                  </li>
                  <li>Após o login, vá para o painel de controle</li>
                  <li>Configure um canal conectando seu WhatsApp</li>
                  <li>Copie o token de autenticação do seu canal</li>
                  <li>Adicione-o como <code>WHAPI_TOKEN</code> nos Edge Secrets do Supabase</li>
                </ol>
              </div>
            </div>
          </Alert>
        </details>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.6fr)]">
              <Card variant="muted" padding="sm">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-1">
                    <div className="text-sm font-medium text-[var(--text-primary)]">
                      Webhook do canal
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      Configure este endpoint na Whapi em Body mode com os eventos `messages`, `statuses` e `channel`.
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Status atual: <span className="font-semibold text-[var(--text-secondary)]">{channelStatus || "unknown"}</span>
                      {channelPhone ? ` · ${channelPhone}` : ""}
                    </p>
                  </div>
                  <Button variant="secondary" onClick={handleRefreshHealth} loading={refreshingHealth}>
                    {!refreshingHealth && <RefreshCcw className="w-4 h-4" />}
                    Atualizar saude
                  </Button>
                </div>

                <div className="mt-3 relative">
                  <Input readOnly value={webhookUrl} size="compact" className="font-mono pr-10" />
                  <IconButton
                    variant="icon"
                    aria-label="Copiar webhook"
                    onClick={handleCopyWebhook}
                    disabled={!webhookUrl}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <Copy className="w-4 h-4" />
                  </IconButton>
                </div>
              </Card>

              <Card variant="muted" padding="sm">
                <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    Ativar canal para automações
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Quando desligado, nenhum lead entra nos fluxos mesmo com a
                    automação marcada como ativa.
                  </p>
                </div>
                <Switch
                  checked={enabled}
                  onChange={(event) => setEnabled(event.target.checked)}
                  aria-label="Ativar canal para automações"
                />
              </div>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                O disparo automático dos fluxos continua sendo controlado em
                Configurações &gt; Automações.
              </p>
            </Card>
            <Alert
              className="lg:col-span-2"
              tone={tokenConfigured ? "success" : "warning"}
            >
              <div className="space-y-1 text-sm">
                <p className="font-semibold">Credencial Whapi protegida</p>
                <p>
                  {tokenConfigured
                    ? "WHAPI_TOKEN está configurado nos Edge Secrets."
                    : "Configure WHAPI_TOKEN nos Edge Secrets do Supabase para ativar a comunicação."}
                </p>
              </div>
            </Alert>
          </div>

          <div className="flex items-center justify-end border-t border-[var(--border-subtle)] pt-4">
            <Button onClick={handleSave} loading={saving}>
              {!saving && <Save className="w-4 h-4" />}
              <span>{saving ? "Salvando..." : "Salvar configuração"}</span>
            </Button>
          </div>
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
