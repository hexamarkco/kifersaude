import { useState } from "react";
import { Brain, Pencil, Power, PowerOff } from "lucide-react";

import { Badge, Button, Card, ConfirmDialog } from "../../../../design-system";
import type { AiFeatureWithConfig, AiFeatureCategory } from "../aiConfigTypes";
import { AI_FEATURE_LABELS } from "../aiConfigTypes";

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
          const hasActive = !!feature.active_config;
          const label = AI_FEATURE_LABELS[feature.key] ?? feature.name;

          return (
            <div
              key={feature.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-subtle)] transition-colors"
            >
              <Brain className={`h-4 w-4 shrink-0 ${hasActive ? "text-[var(--brand-primary)]" : "text-[var(--text-muted)]"}`} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {label}
                  </span>
                  {hasActive ? (
                    <Badge tone="success" size="sm">
                      v{feature.active_config!.version}
                    </Badge>
                  ) : (
                    <Badge tone="neutral" size="sm">
                      Sem config
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
                {hasActive && (
                  <Badge
                    tone={feature.active_config!.is_active ? "success" : "neutral"}
                    size="sm"
                  >
                    {feature.active_config!.is_active ? "Ativo" : "Inativo"}
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(feature)}
                  title="Configurar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {hasActive && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setConfirmTarget({
                        configId: feature.active_config!.id,
                        action: feature.active_config!.is_active ? "deactivate" : "activate",
                      })
                    }
                    title={feature.active_config!.is_active ? "Desativar" : "Ativar"}
                  >
                    {feature.active_config!.is_active ? (
                      <PowerOff className="h-3.5 w-3.5 text-[var(--color-danger)]" />
                    ) : (
                      <Power className="h-3.5 w-3.5 text-[var(--color-success)]" />
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
          ? "A feature voltará a usar os valores padrão do sistema enquanto nenhuma versão estiver ativa."
          : "Esta versão será ativada e passará a ser usada pela feature."
      }
      confirmLabel={confirmTarget?.action === "deactivate" ? "Desativar" : "Ativar"}
      destructive={confirmTarget?.action === "deactivate"}
      closeOnConfirm
    />
    </>
  );
}
