const DEFAULT_COLOR = '#6b7280';

const normalizeHex = (color: string): string => {
  if (!color) return DEFAULT_COLOR;
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
  return DEFAULT_COLOR;
};

export const hexToRgba = (hexColor: string, alpha = 1): string => {
  const hex = normalizeHex(hexColor).replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getContrastTextColor = (hexColor: string): string => {
  const hex = normalizeHex(hexColor).replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1f2937' : '#ffffff';
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
