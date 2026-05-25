import { memo } from "react";
import { Users } from "lucide-react";

import type { Lead } from "../../../lib/supabase";
import { Badge, Input, Surface } from "../../../design-system";
import { KanbanCard } from "./KanbanCard";

type StatusColumn = {
  id: string;
  nome: string;
  cor: string | null;
};

type KanbanColumnProps = {
  column: StatusColumn;
  leads: Lead[];
  wipLimit: number;
  isOverLimit: boolean;
  chipColor: string;
  onDrop: (columnId: string) => void;
  onDragStart: (lead: Lead) => void;
  onUpdateWipLimit: (columnId: string, value: number) => void;
  onLeadClick?: (lead: Lead) => void;
  onConvertToContract?: (lead: Lead) => void;
  getResponsavelLabel: (lead: Lead) => string;
};

function KanbanColumnBase({
  column,
  leads,
  wipLimit,
  isOverLimit,
  chipColor,
  onDrop,
  onDragStart,
  onUpdateWipLimit,
  onLeadClick,
  onConvertToContract,
  getResponsavelLabel,
}: KanbanColumnProps) {
  return (
    <Surface
      variant={isOverLimit ? "danger" : "muted"}
      padding="sm"
      className="w-80 flex-shrink-0 snap-start rounded-[1.6rem] border p-4"
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDrop(column.id)}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: chipColor }}
            />
            <h4
              className="truncate text-sm font-semibold"
              style={{ color: "var(--panel-text)" }}
            >
              {column.nome}
            </h4>
          </div>
          {wipLimit > 0 && (
            <p
              className="mt-1 text-xs font-medium"
              style={{
                color: isOverLimit
                  ? "var(--panel-accent-red-text)"
                  : "var(--panel-text-muted)",
              }}
            >
              Limite WIP: {wipLimit}
            </p>
          )}
        </div>

        <Badge tone={isOverLimit ? "danger" : "neutral"}>
          {leads.length}
        </Badge>
      </div>

      <label
        className="kds-surface kds-surface-default mb-4 flex items-center justify-between gap-3 rounded-[1.15rem] px-3 py-2 text-xs font-medium"
      >
        <span style={{ color: "var(--panel-text-muted)" }}>
          Limite WIP
        </span>
        <div className="w-20">
          <Input
            type="number"
            min={0}
            value={wipLimit}
            onChange={(event) =>
              onUpdateWipLimit(column.id, Number(event.target.value))
            }
            size="compact"
            className="text-right"
          />
        </div>
      </label>

      <div className="max-h-[calc(100vh-320px)] space-y-3 overflow-y-auto pr-1">
        {leads.length === 0 ? (
          <Surface
            variant="muted"
            className="border-dashed px-4 py-8 text-center"
          >
            <Users className="mx-auto mb-2 h-8 w-8 opacity-70" />
            <p className="text-sm font-medium">Nenhum lead</p>
          </Surface>
        ) : (
          leads.map((lead) => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              responsavelLabel={getResponsavelLabel(lead)}
              onConvertToContract={onConvertToContract}
              onDragStart={onDragStart}
              onClick={onLeadClick}
            />
          ))
        )}
      </div>
    </Surface>
  );
}

export const KanbanColumn = memo(KanbanColumnBase);
