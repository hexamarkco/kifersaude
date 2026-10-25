import { Text, Heading, TextLink } from '../../../../design-system';
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Copy,
  Info,
  RefreshCcw,
  Save,
} from "lucide-react";

import { configService } from "../../data/configService";
import {
  AUTO_CONTACT_INTEGRATION_SLUG,
  normalizeAutoContactSettings,
  type AutoContactSettings,
} from "../../../../lib/autoContactService";
import type { IntegrationSetting } from "../../domain/types";
import { WhatsAppApiSkeleton } from '../../../../design-system';
import { useAdaptiveLoading } from "../../../../hooks/useAdaptiveLoading";
import { PanelAdaptiveLoadingFrame } from '../../../../design-system';
import { toast } from "../../../../lib/toast";
import { formatConnectionStatusLabel } from '../../../communication/whatsapp';
import {
  Alert,
  Button,
  Card,
  IconButton,
  Input,
  Switch,
} from "../../../../design-system";
import {
  loadWhatsAppChannelState,
  type ChannelAdminState,
} from "../data/integrationsApi";

type MessageState = { type: "success" | "error"; text: string } | null;
const formatDiagnosticDate = (value: string) => new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "medium",
}).format(new Date(value));

export default function WhatsAppApiSettingsPanel() {
  const [autoContactIntegration, setAutoContactIntegration] =
    useState<IntegrationSetting | null>(null);
  const [autoContactSettings, setAutoContactSettings] =
    useState<AutoContactSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshingHealth, setRefreshingHealth] = useState(false);
  const loadingUi = useAdaptiveLoading(loading);

  const setStatusMessage = (message: MessageState) => {
    if (!message) return;
    if (message.type === "success") toast.success(message.text);
    else toast.error(message.text);
  };

  const [enabled, setEnabled] = useState(false);
  const [tokenConfigured, setTokenConfigured] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookAuthentication, setWebhookAuthentication] =
    useState<"header" | "legacy_query">("legacy_query");
  const [webhookHeaderName, setWebhookHeaderName] = useState("");
  const [channelStatus, setChannelStatus] = useState("unknown");
  const [channelPhone, setChannelPhone] = useState("");
  const [webhookDiagnostics, setWebhookDiagnostics] = useState<
    NonNullable<ChannelAdminState["config"]["webhookDiagnostics"]>
  >({});
  const settingsLoadRequestIdRef = useRef(0);
  const channelStateRequestIdRef = useRef(0);

  const loadChannelState = useCallback(async (action: "getConfig" | "refreshHealth") => {
    const requestId = ++channelStateRequestIdRef.current;
    const payload = await loadWhatsAppChannelState(action);
    if (requestId !== channelStateRequestIdRef.current) return false;

    setTokenConfigured(payload.config?.tokenConfigured === true);
    setWebhookUrl(payload.config?.webhookUrl?.trim() || "");
    setWebhookAuthentication(
      payload.config?.webhookAuthentication === "header"
        ? "header"
        : "legacy_query",
    );
    setWebhookHeaderName(payload.config?.webhookHeaderName?.trim() || "");
    setWebhookDiagnostics(payload.config?.webhookDiagnostics ?? {});
    setChannelStatus(payload.channel?.connection_status?.trim() || "unknown");
    setChannelPhone(payload.channel?.phone_number?.trim() || "");
    return true;
  }, []);

  const loadSettings = useCallback(async () => {
    const requestId = ++settingsLoadRequestIdRef.current;
    setLoading(true);
    setStatusMessage(null);

    try {
      const [integration] = await Promise.all([
        configService.getIntegrationSetting(AUTO_CONTACT_INTEGRATION_SLUG),
        loadChannelState("getConfig"),
      ]);
      if (requestId !== settingsLoadRequestIdRef.current) return;
      const normalized = normalizeAutoContactSettings(integration?.settings);

      setAutoContactIntegration(integration);
      setAutoContactSettings(normalized);

      setEnabled(normalized.enabled);
    } catch (error) {
      if (requestId !== settingsLoadRequestIdRef.current) return;
      console.error("[WhatsAppApiSettings] Error loading settings:", error);
      setStatusMessage({
        type: "error",
        text: "Erro ao carregar configurações.",
      });
    } finally {
      if (requestId === settingsLoadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [loadChannelState]);

  useEffect(() => {
    void loadSettings();
    return () => {
      settingsLoadRequestIdRef.current += 1;
      channelStateRequestIdRef.current += 1;
    };
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
      await loadChannelState("getConfig");

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
      const applied = await loadChannelState("refreshHealth");
      if (applied) {
        toast.success("Situação da conexão atualizada.");
      }
    } catch (error) {
      console.error("[WhatsAppApiSettings] Error refreshing health:", error);
      toast.error("Não foi possível atualizar a saúde do canal.");
    } finally {
      setRefreshingHealth(false);
    }
  };

  const handleCopyWebhook = async () => {
    if (!webhookUrl) return;

    try {
      let copied = false;

      if (navigator.clipboard?.writeText && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(webhookUrl);
          copied = true;
        } catch {
          // Safari pode bloquear a API mesmo em contexto seguro; use o fallback abaixo.
        }
      }

      if (!copied) {
        const fallbackInput = document.createElement("textarea");
        fallbackInput.value = webhookUrl;
        fallbackInput.setAttribute("readonly", "");
        fallbackInput.style.position = "fixed";
        fallbackInput.style.opacity = "0";
        fallbackInput.style.pointerEvents = "none";
        document.body.appendChild(fallbackInput);
        fallbackInput.select();

        copied = document.execCommand("copy");
        fallbackInput.remove();

        if (!copied) throw new Error("Clipboard fallback failed");
      }

      toast.success("Endereço da conexão copiado.");
    } catch {
      toast.error("Não foi possível copiar o endereço da conexão agora.");
    }
  };

  if (!autoContactIntegration && !loading) {
    return (
      <Alert tone="warning">
        <div className="flex items-start gap-3">
        <Info className="mt-1 h-5 w-5" />
        <div className="space-y-1 text-sm">
          <Text className="font-semibold">
            Integração de automação não encontrada.
          </Text>
          <Text>Peça ao responsável pelo sistema para concluir a configuração do WhatsApp.</Text>
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
      overlayLabel="Atualizando conexão do WhatsApp..."
      stageClassName="min-h-[340px]"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-[var(--kds-radius-md)] border border-[var(--border-subtle)] p-4">
            <div className="space-y-1">
              <Heading level={3} className="text-sm font-semibold text-[var(--text-primary)]">Conexão do WhatsApp</Heading>
              <Text className="text-sm text-[var(--text-secondary)]">{formatConnectionStatusLabel(channelStatus)}{channelPhone ? ` · ${channelPhone}` : ''}</Text>
              <Text className="text-xs text-[var(--text-muted)]">Confira a conexão antes de ativar as mensagens automáticas.</Text>
              <Text className="text-xs text-[var(--text-secondary)]">{webhookDiagnostics.status === "receiving_messages" ? "As mensagens estão chegando ao sistema." : webhookDiagnostics.status === "error" ? "Houve um problema ao receber a última atualização. Peça ajuda ao suporte." : "Ainda não há recebimento de mensagens confirmado. Confira a conexão antes de usar as automações."}</Text>
            </div>
            <Button variant="secondary" onClick={handleRefreshHealth} loading={refreshingHealth}>Atualizar conexão</Button>
          </div>
          <Card variant="muted" padding="sm">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  Ativar canal para automações
                </div>
                <Text className="text-xs text-[var(--text-muted)]">
                  Quando desligado, nenhum lead entra nos fluxos mesmo com a
                  automação marcada como ativa.
                </Text>
              </div>
              <Switch
                checked={enabled}
                onChange={(event) => setEnabled(event.target.checked)}
                aria-label="Ativar canal para automações"
              />
            </div>
            <Text className="mt-3 text-xs text-[var(--text-muted)]">
              O disparo automático dos fluxos continua sendo controlado em
              Configurações &gt; Automações.
            </Text>
          </Card>
          <Alert
            className="h-full"
            tone={tokenConfigured ? "success" : "warning"}
          >
            <div className="space-y-1 text-sm">
              <Text className="font-semibold">Acesso ao serviço de WhatsApp</Text>
              <Text>
                {tokenConfigured
                  ? "A chave de acesso está configurada e protegida no sistema."
                  : "Peça ao responsável pelo sistema para configurar a chave de acesso e concluir a conexão."}
              </Text>
            </div>
          </Alert>
          <details className="lg:col-span-2 space-y-3">
            <summary className="cursor-pointer text-sm font-medium text-[var(--text-secondary)]">Configuração avançada para o suporte</summary>
            <details className="group">
              <summary className="cursor-pointer text-sm font-medium text-[var(--text-secondary)]">
                Ajuda para configurar a conexão (responsável técnico)
              </summary>
              <Alert tone="info" className="mt-3">
                <div className="flex items-start gap-3">
                  <Info className="mt-0.5 h-5 w-5 shrink-0" />
                  <div className="space-y-2 text-sm">
                    <Text className="font-semibold">
                      Como obter seu token da Whapi Cloud:
                    </Text>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>
                        Acesse{" "}
                        <TextLink
                          href="https://whapi.cloud"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline"
                        >
                          whapi.cloud
                        </TextLink>{" "}
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
            <Card variant="muted" padding="sm">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    Configuração de recebimento (webhook)
                  </div>
                  <Text className="text-xs text-[var(--text-muted)]">
                    {webhookAuthentication === "header"
                      ? `Configure este endpoint na Whapi em Body mode com os eventos messages, statuses e channel, usando o header ${webhookHeaderName || "X-Kifer-Webhook-Secret"}.`
                      : "Cole esta URL exatamente como está no campo URL da Whapi (modo Body, eventos messages, statuses e channel). O segredo já vem embutido nela — não precisa configurar header."}
                  </Text>
                  <Text className="text-xs text-[var(--text-muted)]">
                    Status atual: <span className="font-semibold text-[var(--text-secondary)]">{formatConnectionStatusLabel(channelStatus)}</span>
                    {channelPhone ? ` · ${channelPhone}` : ""}
                  </Text>
                </div>
                <IconButton
                  variant="secondary"
                  size="md"
                  onClick={handleRefreshHealth}
                  loading={refreshingHealth}
                  aria-label="Atualizar conexão do WhatsApp"
                  title="Atualizar conexão do WhatsApp"
                >
                  {!refreshingHealth && <RefreshCcw className="kds-control-icon" aria-hidden="true" />}
                </IconButton>
              </div>

              <div className="mt-3">
                <Input
                  readOnly
                  value={webhookUrl}
                  size="md"
                  className="font-mono"
                  action={(
                    <IconButton
                      variant="icon"
                      size="sm"
                      aria-label="Copiar endereço da conexão"
                      title="Copiar endereço da conexão"
                      onClick={handleCopyWebhook}
                      disabled={!webhookUrl}
                    >
                      <Copy className="kds-control-icon" aria-hidden="true" />
                    </IconButton>
                  )}
                />
              </div>
              {webhookAuthentication === "header" ? (
                <Text className="mt-2 text-xs text-[var(--text-muted)]">
                  O valor do header fica somente nos Edge Secrets e nao e exibido no painel.
                </Text>
              ) : (
                <Text className="mt-2 text-xs text-[var(--text-muted)]">
                  Se ao salvar essa URL na Whapi ela oferecer um campo de header customizado, prefira configurar {webhookHeaderName || "X-Kifer-Webhook-Secret"} lá e remover o `secret` da URL — mas se não houver esse campo (comum no plano/tela padrão), pode colar a URL como está.
                </Text>
              )}
              <div className="mt-3">
                {webhookDiagnostics.status === "message_event_missing" ? (
                  <Alert tone="warning">
                    <div className="space-y-1 text-xs">
                      <Text className="font-semibold">O webhook responde, mas nenhuma mensagem chegou</Text>
                      <Text>
                        Na Whapi, edite este webhook e habilite o evento <strong>messages</strong>,
                        ação <strong>post</strong>, método <strong>POST</strong> e modo <strong>Body</strong>.
                        O evento de canal sozinho atualiza QR/AUTH, mas não entrega mensagens ao Inbox.
                      </Text>
                      {webhookDiagnostics.lastWebhookAt ? (
                        <Text>Último evento geral: {formatDiagnosticDate(webhookDiagnostics.lastWebhookAt)}.</Text>
                      ) : null}
                    </div>
                  </Alert>
                ) : webhookDiagnostics.status === "error" ? (
                  <Alert tone="danger">
                    <div className="space-y-1 text-xs">
                      <Text className="font-semibold">O último webhook falhou</Text>
                      <Text>{webhookDiagnostics.lastError || "Consulte os logs da Edge Function."}</Text>
                    </div>
                  </Alert>
                ) : webhookDiagnostics.status === "receiving_messages" ? (
                  <Alert tone="success">
                    <div className="space-y-1 text-xs">
                      <Text className="font-semibold">Eventos de mensagem estão chegando</Text>
                      {webhookDiagnostics.lastMessageWebhookAt ? (
                        <Text>Último evento persistido: {formatDiagnosticDate(webhookDiagnostics.lastMessageWebhookAt)}.</Text>
                      ) : null}
                    </div>
                  </Alert>
                ) : (
                  <Alert tone="info">
                    <Text className="text-xs">
                      Aguardando a primeira mensagem real. O botão de check da Whapi não testa o evento messages.post.
                    </Text>
                  </Alert>
                )}
              </div>
            </Card>

          </details>
        </div>

        <div className="flex items-center justify-end border-t border-[var(--border-subtle)] pt-4">
          <Button onClick={handleSave} loading={saving}>
            {!saving && <Save className="kds-control-icon" />}
            <span>{saving ? "Salvando..." : "Salvar configuração"}</span>
          </Button>
        </div>
      </div>
    </PanelAdaptiveLoadingFrame>
  );
}
