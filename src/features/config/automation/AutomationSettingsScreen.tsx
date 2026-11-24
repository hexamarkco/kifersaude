import type { RecordAction } from '../../../design-system';
import AutoContactFlowSettingsScreen from "./AutoContactFlowSettingsScreen";

export default function AutomationSettingsScreen({ areaActions }: { areaActions: RecordAction[] }) {
  return <AutoContactFlowSettingsScreen areaActions={areaActions} />;
}
