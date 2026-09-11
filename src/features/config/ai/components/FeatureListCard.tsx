import { useState } from "react";
import { Brain, Pencil, Power, PowerOff } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
} from "../../../../design-system";
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
    <Card className="overflow-hidden">
      <div className="border-b border-[var(--border-subtle)] px-4 py-2.5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          {category.label}
        </h3>
      </div>
      <div className="divide-y divide-[var(--border-subtle)]">
        {category.features.map((feature) => {
          const state = getAiFeatureDisplayState(feature);
          const isLegacy = state === "legacy";
          const isActive = state === "active";
          const displayConfig = feature.active_config ?? feature.latest_config;
          const label = AI_FEATURE_LABELS[feature.key] ?? feature.name;

          return (
            <div
              key={feature.id}
              className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--bg-surface-muted)]"
            >
              <Brain className={`h-4 w-4 shrink-0 ${isActive ? "text-[var(--brand-primary)]" : "text-[var(--text-muted)]"}`} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {label}
                  </span>
                  {displayConfig ? (
                    <Badge tone={isActive ? "success" : "neutral"} size="sm">
                      v{displayConfig.version}
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      Sem configuração
                    </Badge>
                  )}
                </div>
                {feature.description && (
                  <p className="mt-0.5 text-xs text-[var(--text-muted)] truncate">
                    {feature.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {displayConfig && (
                  <Badge
                    tone={isActive ? "success" : "neutral"}
                    size="sm"
                  >
                    {isLegacy ? "Desativada" : isActive ? "Ativo" : "Inativo"}
                  </Badge>
                )}
                {!isLegacy && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(feature)}
                    title="Configurar"
                  >
                    <Pencil className="kds-control-icon" />
                  </Button>
                )}
                {!isLegacy && displayConfig && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setConfirmTarget({
                        configId: displayConfig.id,
                        action: isActive ? "deactivate" : "activate",
                      })
                    }
                    title={isActive ? "Desativar" : "Ativar"}
                  >
                    {isActive ? (
                      <PowerOff className="text-[var(--color-danger)]" />
                    ) : (
                      <Power className="text-[var(--success-text)]" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>

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
