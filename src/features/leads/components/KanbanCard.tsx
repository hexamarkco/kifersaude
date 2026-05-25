import { memo } from "react";
import { Calendar, Mail, Phone } from "lucide-react";

import type { Lead } from "../../../lib/supabase";
import { Button } from "../../../design-system";
import { formatDateTimeFullBR } from "../../../lib/dateUtils";

type KanbanCardProps = {
  lead: Lead;
  responsavelLabel: string;
  onConvertToContract?: (lead: Lead) => void;
  onDragStart: (lead: Lead) => void;
  onClick?: (lead: Lead) => void;
};

function KanbanCardBase({ lead, responsavelLabel, onConvertToContract, onDragStart, onClick }: KanbanCardProps) {
  return (
    <div
      draggable
      onDragStart={() => onDragStart(lead)}
      onClick={() => onClick?.(lead)}
      className="kds-surface kds-surface-default kds-action-surface cursor-move rounded-[1.35rem] p-4 transition-all"
    >
      <div className="mb-3">
        <h5
          className="truncate text-base font-semibold"
          style={{ color: "var(--panel-text)" }}
        >
          {lead.nome_completo}
        </h5>
      </div>

      <div
        className="space-y-2 text-sm"
        style={{ color: "var(--panel-text-soft)" }}
      >
        <div className="flex items-center gap-2">
          <Phone className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="truncate">{lead.telefone}</span>
        </div>
        {lead.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.proximo_retorno && (
          <div
            className="flex items-center gap-2"
            style={{
              color: "var(--panel-accent-ink)",
            }}
          >
            <Calendar className="h-3.5 w-3.5 flex-shrink-0" />
            <span>{formatDateTimeFullBR(lead.proximo_retorno)}</span>
          </div>
        )}
      </div>

      <div
        className="mt-4 flex items-center justify-between gap-3 border-t pt-3 text-xs"
        style={{
          borderColor:
            "var(--panel-border-subtle)",
          color: "var(--panel-text-muted)",
        }}
      >
        <span>
          Responsavel:{" "}
          <strong
            style={{
              color: "var(--panel-text-soft)",
            }}
          >
            {responsavelLabel}
          </strong>
        </span>
        <span>
          {lead.data_criacao
            ? new Date(lead.data_criacao).toLocaleDateString(
                "pt-BR",
              )
            : ""}
        </span>
      </div>

      {onConvertToContract && (
        <Button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onConvertToContract(lead);
          }}
          variant="soft"
          size="sm"
          className="mt-4 w-full justify-center"
        >
          Converter em contrato
        </Button>
      )}
    </div>
  );
}

export const KanbanCard = memo(KanbanCardBase);
