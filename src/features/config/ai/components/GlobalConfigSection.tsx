import { useCallback, useState } from "react";
import { Save } from "lucide-react";

import {
  Alert,
  Card,
  Field,
  PageActions,
  SectionHeader,
  Text,
  Textarea,
} from "../../../../design-system";
import { toast } from "../../../../lib/toast";
import { aiConfigService } from "../aiConfigService";
import type { AiGlobalConfigRow } from "../aiConfigTypes";

type Props = {
  configs: AiGlobalConfigRow[];
  onReload: () => void;
};

const GLOBAL_CONFIG_META: Record<string, { label: string; description: string }> = {
  global_instructions: {
    label: "Instruções globais",
    description: "Diretrizes gerais aplicadas a todas as funcionalidades de IA.",
  },
  global_style: {
    label: "Estilo global",
    description: "Tom e formatação padrão para as respostas geradas.",
  },
};

export default function GlobalConfigSection({ configs, onReload }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const config of configs) map[config.key] = config.value;
    return map;
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  const handleSave = useCallback(async (key: string) => {
    setSavingKey(key);
    setSaveErrors((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });
    try {
      const { error } = await aiConfigService.updateGlobalConfig(key, values[key] ?? "");
      if (error) {
        setSaveErrors((previous) => ({ ...previous, [key]: error }));
        return;
      }

      toast.success("Configuração global atualizada.");
      onReload();
    } catch (error) {
      setSaveErrors((previous) => ({
        ...previous,
        [key]: error instanceof Error ? error.message : "Não foi possível salvar a configuração global.",
      }));
    } finally {
      setSavingKey(null);
    }
  }, [onReload, values]);

  return (
    <Card padding="md" className="kds-ai-global-card">
      <SectionHeader
        as="h3"
        title="Configurações globais"
        description="Diretrizes compartilhadas por todos os recursos de inteligência artificial."
        descriptionPlacement="visible"
      />

      <div className="kds-ai-global-fields">
        {Object.entries(GLOBAL_CONFIG_META).map(([key, info], index) => {
          const existing = configs.find((config) => config.key === key);
          const value = values[key] ?? existing?.value ?? "";
          const savedValue = existing?.value ?? "";
          const saving = savingKey === key;

          return (
            <section className="kds-ai-global-field" key={key} aria-label={info.label}>
              <Field
                label={info.label}
                description={info.description}
                descriptionPlacement="tooltip"
              >
                <Textarea
                  value={value}
                  onChange={(event: React.ChangeEvent<HTMLTextAreaElement>) => {
                    setValues((previous) => ({ ...previous, [key]: event.target.value }));
                    setSaveErrors((previous) => {
                      if (!(key in previous)) return previous;
                      const next = { ...previous };
                      delete next[key];
                      return next;
                    });
                  }}
                  rows={5}
                  placeholder={`Digite ${info.label.toLowerCase()}...`}
                />
              </Field>

              {saveErrors[key] && (
                <Alert tone="danger" title="Não foi possível salvar" role="alert" className="kds-ai-global-save-error">
                  {saveErrors[key]}
                </Alert>
              )}

              <div className="kds-ai-global-field-footer">
                <Text className="kds-ai-global-updated">
                  {existing
                    ? `Atualizada em ${new Date(existing.updated_at).toLocaleString("pt-BR")}`
                    : "Ainda não há uma versão personalizada."}
                </Text>
                <PageActions
                  placement="header"
                  primary={{
                    label: index === 0 ? "Salvar instruções" : "Salvar estilo",
                    icon: Save,
                    onClick: () => handleSave(key),
                    disabled: savingKey !== null || value === savedValue,
                    loading: saving,
                  }}
                />
              </div>
            </section>
          );
        })}
      </div>
    </Card>
  );
}
