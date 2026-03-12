export const getReminderWhatsappLink = (phone: string | null | undefined) => {
  if (!phone) {
    return null;
  }

  const normalized = phone.replace(/\D/g, "");
  if (!normalized) {
    return null;
  }

  const phoneWithCountryCode = normalized.startsWith("55")
    ? normalized
    : `55${normalized}`;
  return `https://wa.me/${phoneWithCountryCode}`;
};

export const normalizeReminderLeadPhone = (phone: string | null | undefined) =>
  phone?.replace(/\D/g, "") ?? "";

export const isReminderPriority = (
  value: string,
): value is "normal" | "alta" | "baixa" =>
  value === "normal" || value === "alta" || value === "baixa";
