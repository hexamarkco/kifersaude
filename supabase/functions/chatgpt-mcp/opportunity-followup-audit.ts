type FollowUpRecord = Record<string, unknown>;

type OpportunityRecord = {
  id: string;
  archived: boolean;
  status: string;
  primary_contact_lead_id: string | null;
  member_lead_ids: string[];
  member_count: number;
  members_truncated: boolean;
};

const text = (value: unknown) => typeof value === 'string' ? value.trim() : '';

const dateDay = (value: unknown): string | null => {
  const raw = text(value);
  const timestamp = Date.parse(raw);
  if (!raw || !Number.isFinite(timestamp)) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(timestamp));
  const valueFor = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${valueFor('year')}-${valueFor('month')}-${valueFor('day')}`;
};

const normalizeText = (value: unknown) => text(value).normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ');

export function normalizeOpportunityRecords(value: unknown): { opportunities: OpportunityRecord[]; truncated: boolean } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { opportunities: [], truncated: false };
  const response = value as Record<string, unknown>;
  const rows = Array.isArray(response.opportunities) ? response.opportunities : [];
  const opportunities = rows.flatMap((row): OpportunityRecord[] => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return [];
    const item = row as Record<string, unknown>;
    const id = text(item.id);
    if (!id) return [];
    const memberIds = Array.isArray(item.member_lead_ids) ? item.member_lead_ids.map(text).filter(Boolean) : [];
    const memberCount = Number.isInteger(item.member_count) && Number(item.member_count) >= 0 ? Number(item.member_count) : memberIds.length;
    return [{
      id,
      archived: item.archived === true,
      status: text(item.status),
      primary_contact_lead_id: text(item.primary_contact_lead_id) || null,
      member_lead_ids: memberIds,
      member_count: memberCount,
      // members_truncated describes the display-oriented `members` array. The
      // separate member_lead_ids array is complete unless its count proves otherwise.
      members_truncated: memberCount > memberIds.length,
    }];
  });
  return { opportunities, truncated: response.opportunities_truncated === true };
}

export function auditOpportunityFollowUps(params: {
  opportunities: OpportunityRecord[];
  reminders: FollowUpRecord[];
  schedules: FollowUpRecord[];
}): Array<Record<string, unknown>> {
  const issues: Array<Record<string, unknown>> = [];
  const remindersById = new Map<string, FollowUpRecord[]>();
  const schedulesById = new Map<string, FollowUpRecord[]>();
  for (const reminder of params.reminders) {
    const leadId = text(reminder.lead_id);
    if (leadId) remindersById.set(leadId, [...(remindersById.get(leadId) ?? []), reminder]);
  }
  for (const schedule of params.schedules) {
    const leadId = text(schedule.lead_id);
    if (leadId) schedulesById.set(leadId, [...(schedulesById.get(leadId) ?? []), schedule]);
  }

  for (const opportunity of params.opportunities) {
    if (opportunity.archived || ['won', 'lost'].includes(opportunity.status)) continue;
    const activeMemberIds = [...new Set(opportunity.member_lead_ids)];
    if (activeMemberIds.length < 2) continue;

    const reminderRows = activeMemberIds.flatMap((leadId) => (remindersById.get(leadId) ?? []).map((row) => ({ leadId, row })));
    const scheduleRows = activeMemberIds.flatMap((leadId) => (schedulesById.get(leadId) ?? []).map((row) => ({ leadId, row })));
    const duplicateGroups = new Map<string, { leadIds: Set<string>; reminderIds: string[]; scheduledIds: string[] }>();
    for (const { leadId, row } of reminderRows) {
      const day = dateDay(row.data_lembrete);
      const reminderType = normalizeText(row.tipo);
      const title = normalizeText(row.titulo);
      if (!day || (!reminderType && !title)) continue;
      const signature = `reminder|${reminderType}|${title}|${day}`;
      const group = duplicateGroups.get(signature) ?? { leadIds: new Set<string>(), reminderIds: [], scheduledIds: [] };
      group.leadIds.add(leadId);
      group.reminderIds.push(text(row.id));
      duplicateGroups.set(signature, group);
    }
    for (const { leadId, row } of scheduleRows) {
      const day = dateDay(row.scheduled_at);
      const message = normalizeText(row.text_content);
      if (!day || !message) continue;
      const signature = `message|${message}|${day}`;
      const group = duplicateGroups.get(signature) ?? { leadIds: new Set<string>(), reminderIds: [], scheduledIds: [] };
      group.leadIds.add(leadId);
      group.scheduledIds.push(text(row.id));
      duplicateGroups.set(signature, group);
    }
    for (const group of duplicateGroups.values()) {
      if (group.leadIds.size < 2) continue;
      issues.push({
        code: 'DUPLICATE_OPPORTUNITY_FOLLOW_UP',
        opportunity_id: opportunity.id,
        lead_ids: [...group.leadIds],
        reminder_ids: group.reminderIds.filter(Boolean),
        scheduled_message_ids: group.scheduledIds.filter(Boolean),
      });
    }

    const remindersByDay = new Map<string, { leadIds: Set<string>; reminderIds: string[] }>();
    for (const { leadId, row } of reminderRows) {
      const day = dateDay(row.data_lembrete);
      if (!day) continue;
      const group = remindersByDay.get(day) ?? { leadIds: new Set<string>(), reminderIds: [] };
      group.leadIds.add(leadId);
      group.reminderIds.push(text(row.id));
      remindersByDay.set(day, group);
    }
    for (const [day, group] of remindersByDay) {
      if (group.leadIds.size < 2) continue;
      issues.push({
        code: 'CONFLICTING_OPPORTUNITY_NEXT_RETURNS',
        opportunity_id: opportunity.id,
        date: day,
        lead_ids: [...group.leadIds],
        reminder_ids: group.reminderIds.filter(Boolean),
      });
    }

    if (opportunity.primary_contact_lead_id) {
      for (const { leadId, row } of scheduleRows) {
        if (leadId === opportunity.primary_contact_lead_id) continue;
        issues.push({
          code: 'NON_PRIMARY_CONTACT_FOLLOW_UP_WITHOUT_RECORDED_JUSTIFICATION',
          opportunity_id: opportunity.id,
          lead_id: leadId,
          primary_contact_lead_id: opportunity.primary_contact_lead_id,
          scheduled_message_id: text(row.id),
          justification_recorded: false,
        });
      }
    }
  }

  return issues;
}
