import { useCallback, useState } from "react";
import { Save } from "lucide-react";

import {
  Button,
  Card,
  Input,
  Textarea,
} from "../../../../design-system";
import { toast } from "../../../../lib/toast";
import { aiConfigService } from "../aiConfigService";
import type { AiGlobalConfigRow } from "../aiConfigTypes";

type Props = {
  configs: AiGlobalConfigRow[];
  onReload: () => void;
};

const GLOBAL_CONFIG_META: Record<string, { label: string; description: string; type: "text" | "textarea" }> = {
  global_instructions: {
    label: "Instruções Globais",
    description: "Diretrizes gerais que se aplicam a TODAS as features de IA.",
    type: "textarea",
  },
  global_style: {
    label: "Estilo Global",
    description: "Tom, formatação e estilo padrão para todas as respostas.",
    type: "textarea",
  },
};

export default function GlobalConfigSection({ configs, onReload }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const c of configs) map[c.key] = c.value;
    return map;
  });
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async (key: string) => {
    setSaving(true);
    const { error } = await aiConfigService.updateGlobalConfig(key, values[key] ?? "");
    setSaving(false);

    if (error) return toast.error(error);
    toast.success("Salvo com sucesso");
    onReload();
  }, [values, onReload]);

  const meta = GLOBAL_CONFIG_META;

  return (
    <div className="space-y-4">
      {Object.entries(meta).map(([key, info]) => {
        const existing = configs.find((c) => c.key === key);
        const val = values[key] ?? existing?.value ?? "";

        return (
          <Card key={key} className="p-5 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                {info.label}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {info.description}
              </p>
            </div>

            {info.type === "textarea" ? (
              <Textarea
                value={val}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                rows={6}
                className="font-mono text-sm"
                placeholder={`Digite as ${info.label.toLowerCase()}...`}
              />
            ) : (
              <Input
                value={val}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValues((prev) => ({ ...prev, [key]: e.target.value }))}
                placeholder={`Digite...`}
              />
            )}

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={() => handleSave(key)}
                disabled={saving}
              >
                {!saving && <Save className="h-3.5 w-3.5" />}
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>

            {existing && (
              <p className="text-xs text-[var(--text-muted)]">
                Última atualização: {new Date(existing.updated_at).toLocaleString("pt-BR")}
              </p>
            )}
          </Card>
        );
      })}

      {Object.keys(meta).length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Nenhuma configuração global disponível.
          </p>
        </Card>
      )}
    </div>
  );
}
