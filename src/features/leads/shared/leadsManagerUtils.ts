export const isWithinDateRange = (
  dateValue: string | null | undefined,
  from: string,
  to: string,
) => {
  if (!from && !to) {
    return true;
  }

  if (!dateValue) {
    return false;
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  if (from) {
    const fromDate = new Date(`${from}T00:00:00`);
    if (date < fromDate) {
      return false;
    }
  }

  if (to) {
    const toDate = new Date(`${to}T23:59:59`);
    if (date > toDate) {
      return false;
    }
  }

  return true;
};

export const getWhatsappLink = (phone: string | null | undefined) => {
  if (!phone) {
    return null;
  }

  const normalized = phone.replace(/\D/g, "");
  return normalized ? `https://wa.me/55${normalized}` : null;
};

export const getLeadFirstName = (fullName: string | null | undefined) => {
  if (!fullName) {
    return "cliente";
  }

  const trimmed = fullName.trim();
  if (!trimmed) {
    return "cliente";
  }

  const [firstName] = trimmed.split(/\s+/);
  return firstName || "cliente";
};
