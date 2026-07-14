const DEFAULT_COLOR = 'var(--text-muted)';

const normalizeHex = (color: string): string | null => {
  if (!color) return null;
  const hex = color.trim();
  if (hex.startsWith('#') && (hex.length === 7 || hex.length === 4)) {
    if (hex.length === 4) {
      const r = hex[1];
      const g = hex[2];
      const b = hex[3];
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return hex;
  }
  return null;
};

const getColor = (color: string): string => normalizeHex(color) ?? DEFAULT_COLOR;

export const hexToRgba = (hexColor: string, alpha = 1): string => {
  const opacity = Math.min(Math.max(alpha, 0), 1) * 100;
  return `color-mix(in srgb, ${getColor(hexColor)} ${opacity}%, transparent)`;
};

export const getContrastTextColor = (hexColor: string): string => {
  const normalized = normalizeHex(hexColor);
  if (!normalized) return 'var(--text-on-brand)';

  const hex = normalized.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? 'var(--text-primary)' : 'var(--text-on-brand)';
};

export const getBadgeStyle = (hexColor: string, alpha = 0.15) => {
  const backgroundColor = hexToRgba(hexColor, alpha);
  const textColor = getContrastTextColor(hexColor);
  return {
    backgroundColor,
    color: textColor,
    borderColor: hexToRgba(hexColor, Math.min(alpha + 0.25, 1)),
  };
};
