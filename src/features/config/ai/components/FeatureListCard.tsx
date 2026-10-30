import { Badge, ButtonGroup, ConfirmDialog, Heading, IconButton, Text } from '../../../../design-system';
import { useState } from "react";
import { Pencil, Power, PowerOff } from "lucide-react";

import type { AiFeatureWithConfig, AiFeatureCategory } from "../aiConfigTypes";
import { AI_FEATURE_LABELS } from "../aiConfigTypes";
import { getAiFeatureDisplayState } from "../aiFeatureState";

type Props = {
  category: AiFeatureCategory;
  onEdit: (feature: AiFeatureWithConfig) => void;
  onDeactivate: (configId: string) => void;
  onActivate: (configId: string) => void;
};

export default function FeatureListCard({ category, onEdit, onDeactivate, onActivate }: Props) {
  const [confirmTarget, setConfirmTarget] = useState<{ configId: string; action: "deactivate" | "activate" } | null>(null);

  return (
    <>
    <section className="kds-ai-category-section" aria-label={category.label}>
      <div className="kds-ai-category-heading">
        <Heading level={3} className="text-sm font-semibold text-[var(--text-primary)]">
          {category.label}
        </Heading>
        <Badge tone="neutral" size="sm">{category.features.length}</Badge>
      </div>
      <div className="kds-ai-feature-list">
        {category.features.map((feature) => {
          const state = getAiFeatureDisplayState(feature);
          const isLegacy = state === "legacy";
          const isActive = state === "active";
          const displayConfig = feature.active_config ?? feature.latest_config;
          const label = AI_FEATURE_LABELS[feature.key] ?? feature.name;

          return (
            <div
              key={feature.id}
              className="kds-ai-feature-row"
            >
              <div className="kds-ai-feature-copy">
                <div className="kds-ai-feature-title-row">
                  <span className="kds-ai-feature-title">
                    {label}
                  </span>
                  {displayConfig && (
                    <Badge tone="neutral" size="sm">
                      v{displayConfig.version}
                    </Badge>
                  )}
                </div>
                {feature.description && (
                  <Text className="kds-ai-feature-description">
                    {feature.description}
                  </Text>
                )}
              </div>

              <div className="kds-ai-feature-actions">
                <Badge
                  tone={isLegacy ? "neutral" : isActive ? "success" : displayConfig ? "warning" : "neutral"}
                  size="sm"
                >
                  {isLegacy ? "Legada" : isActive ? "Ativa" : displayConfig ? "Inativa" : "Não configurada"}
                </Badge>
                <ButtonGroup size="sm" aria-label={`Ações para ${label}`}>
                {!isLegacy && (
                  <IconButton
                    variant="secondary"
                    size="sm"
                    onClick={() => onEdit(feature)}
                    title="Configurar"
                    aria-label={`Configurar ${label}`}
                  >
                    <Pencil />
                  </IconButton>
                )}
                {!isLegacy && displayConfig && (
                  <IconButton
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      setConfirmTarget({
                        configId: displayConfig.id,
                        action: isActive ? "deactivate" : "activate",
                      })
                    }
                    title={isActive ? "Desativar" : "Ativar"}
                    aria-label={`${isActive ? "Desativar" : "Ativar"} ${label}`}
                  >
                    {isActive ? (
                      <PowerOff className="text-[var(--color-danger)]" />
                    ) : (
                      <Power className="text-[var(--success-text)]" />
                    )}
                  </IconButton>
                )}
                </ButtonGroup>
              </div>
            </div>
          );
        })}
      </div>
    </section>

    <ConfirmDialog
      open={!!confirmTarget}
      onOpenChange={() => setConfirmTarget(null)}
      onConfirm={() => {
        if (!confirmTarget) return;
        if (confirmTarget.action === "deactivate") {
          onDeactivate(confirmTarget.configId);
        } else {
          onActivate(confirmTarget.configId);
        }
        setConfirmTarget(null);
      }}
      title={confirmTarget?.action === "deactivate" ? "Desativar configuração?" : "Ativar configuração?"}
      description={
        confirmTarget?.action === "deactivate"
          ? "A funcionalidade voltará a usar os valores padrão do sistema enquanto nenhuma versão estiver ativa."
          : "Esta versão será ativada e passará a ser usada pela funcionalidade."
      }
      confirmLabel={confirmTarget?.action === "deactivate" ? "Desativar" : "Ativar"}
      destructive={confirmTarget?.action === "deactivate"}
      closeOnConfirm
    />
    </>
  );
}
