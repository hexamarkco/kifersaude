import { Bot } from "lucide-react";

import { CardIcon, SectionHeader } from "../../../design-system";
import AutoContactFlowSettingsScreen from "./AutoContactFlowSettingsScreen";

export default function AutomationSettingsScreen() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 px-1">
        <CardIcon>
          <Bot className="h-5 w-5" />
        </CardIcon>
        <SectionHeader
          title="Fluxos de automação"
          description="Crie e acompanhe gatilhos, condições, bifurcações e ações automáticas em um único espaço operacional."
        />
      </div>
      <AutoContactFlowSettingsScreen />
    </div>
  );
}
