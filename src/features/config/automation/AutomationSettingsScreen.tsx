import { Bot, Sparkles } from "lucide-react";

import { Badge, CardIcon, SectionHeader, Surface } from "../../../design-system";
import AutoContactFlowSettingsScreen from "./AutoContactFlowSettingsScreen";

export default function AutomationSettingsScreen() {
  return (
    <div className="panel-page-shell space-y-6">
      <Surface padding="lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-4">
              <Badge tone="gold"><Sparkles className="h-3.5 w-3.5" />Automações</Badge>
              <div className="flex items-start gap-4">
                <CardIcon>
                  <Bot className="h-6 w-6" />
                </CardIcon>
                <SectionHeader
                  title="Fluxos de automação"
                  description={
                    <span className="max-w-3xl text-sm leading-6">
                      Crie automações generalistas com gatilhos, condições,
                      bifurcações e ações em um fluxo mais consistente com o
                      restante de configurações.
                    </span>
                  }
                />
              </div>
          </div>
        </div>
      </Surface>

      <Surface variant="muted" padding="lg">
        <AutoContactFlowSettingsScreen />
      </Surface>
    </div>
  );
}
