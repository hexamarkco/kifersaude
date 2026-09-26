export type CampaignResponsibleOption = {
  id: string;
  label: string | null;
  value: string | null;
};

const normalizeFilterValue = (value: string | null | undefined): string => value?.trim() ?? '';

/**
 * The campaign form stores the responsible person's value, while older
 * drafts may store the UUID or label. Resolve all supported forms to the
 * foreign keys used by the current leads table.
 */
export const resolveResponsibleIds = (
  selectedValues: string[],
  options: CampaignResponsibleOption[],
): string[] => {
  const selected = new Set(selectedValues.map(normalizeFilterValue).filter(Boolean));
  if (selected.size === 0) return [];

  const ids = new Set<string>();
  for (const option of options) {
    const optionId = normalizeFilterValue(option.id);
    if (!optionId) continue;

    if (
      selected.has(optionId)
      || selected.has(normalizeFilterValue(option.value))
      || selected.has(normalizeFilterValue(option.label))
    ) {
      ids.add(optionId);
    }
  }

  return Array.from(ids);
};

export const getResponsibleDisplayName = (
  responsibleId: string | null | undefined,
  options: CampaignResponsibleOption[],
): string | null => {
  const normalizedId = normalizeFilterValue(responsibleId);
  if (!normalizedId) return null;

  const option = options.find((item) => normalizeFilterValue(item.id) === normalizedId);
  return normalizeFilterValue(option?.label) || normalizeFilterValue(option?.value) || null;
};
