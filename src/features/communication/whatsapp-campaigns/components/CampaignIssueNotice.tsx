import { Text } from '../../../../design-system';
import { describeCampaignIssue } from '../domain/campaignIssuePresentation';

export function CampaignIssueNotice({ reason, details }: { reason: string | null; details?: string[] }) {
  if (!reason) return <span>—</span>;
  const issue = describeCampaignIssue(reason);
  return (
    <div className="min-w-0 space-y-1">
      <Text className="text-sm font-medium text-[color:var(--panel-text)]">{issue.title}</Text>
      <Text className="text-xs leading-relaxed text-[color:var(--panel-text-soft)]">{issue.guidance}</Text>
      <details className="text-xs text-[color:var(--panel-text-muted)]">
        <summary className="cursor-pointer">Informações para o suporte</summary>
        {(details || [reason]).map((detail) => <Text key={detail} className="mt-2 break-words">{detail}</Text>)}
      </details>
    </div>
  );
}
