import type { CSSProperties } from "react";

export const PANEL_SECTION_STYLE: CSSProperties = {
  borderColor: "var(--panel-border,#d4c0a7)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--panel-surface,#fffdfa) 97%, white 3%) 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 92%, var(--panel-surface-soft,#efe6d8) 8%) 100%)",
  boxShadow: "0 26px 50px -38px rgba(26,18,13,0.38)",
};

export const PANEL_INSET_STYLE: CSSProperties = {
  borderColor: "var(--panel-border-subtle,#e4d5c0)",
  background:
    "color-mix(in srgb, var(--panel-surface,#fffdfa) 92%, transparent)",
};

export const PANEL_MUTED_INSET_STYLE: CSSProperties = {
  borderColor: "var(--panel-border-subtle,#e4d5c0)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 55%, transparent) 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 96%, transparent) 100%)",
};

export const PANEL_PILL_STYLE: CSSProperties = {
  borderColor: "var(--panel-border-subtle,#e4d5c0)",
  background:
    "color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 72%, transparent)",
};

export const PANEL_HERO_STYLE: CSSProperties = {
  borderColor: "var(--panel-border,#d4c0a7)",
  background:
    "linear-gradient(135deg, color-mix(in srgb, var(--panel-surface,#fffdfa) 90%, transparent) 0%, color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 84%, transparent) 100%), radial-gradient(circle at top right, rgba(212,120,42,0.2), transparent 34%), radial-gradient(circle at bottom left, rgba(120,72,34,0.18), transparent 42%)",
  boxShadow: "0 30px 54px -40px rgba(26,18,13,0.4)",
};

export const PANEL_EMPTY_STATE_STYLE: CSSProperties = {
  borderColor: "var(--panel-border-subtle,#e4d5c0)",
  background:
    "color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 62%, transparent)",
  color: "var(--panel-text-muted,#876f5c)",
};

export type PanelTone =
  | "neutral"
  | "accent"
  | "info"
  | "success"
  | "warning"
  | "danger";

const PANEL_TONE_STYLES: Record<PanelTone, CSSProperties> = {
  neutral: {
    borderColor: "var(--panel-border-subtle,#e4d5c0)",
    background:
      "color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 72%, transparent)",
    color: "var(--panel-text-soft,#5b4635)",
  },
  accent: {
    borderColor: "var(--panel-accent-border,#d5a25c)",
    background: "var(--panel-accent-soft,#f6e4c7)",
    color: "var(--panel-accent-ink,#6f3f16)",
  },
  info: {
    borderColor: "var(--panel-accent-blue-border,#a8c0d8)",
    background: "var(--panel-accent-blue-bg,#edf3fb)",
    color: "var(--panel-accent-blue-text,#31577a)",
  },
  success: {
    borderColor: "var(--panel-accent-green-border,#95c4a1)",
    background: "var(--panel-accent-green-bg,#edf6ef)",
    color: "var(--panel-accent-green-text,#275c39)",
  },
  warning: {
    borderColor: "var(--panel-accent-border,#d5a25c)",
    background: "var(--panel-accent-warm,#efcf9f)",
    color: "var(--panel-accent-ink-strong,#4a2411)",
  },
  danger: {
    borderColor: "var(--panel-accent-red-border,#d79a8f)",
    background: "var(--panel-accent-red-bg,#faecea)",
    color: "var(--panel-accent-red-text,#8a3128)",
  },
};

export const getPanelToneStyle = (tone: PanelTone): CSSProperties => ({
  ...PANEL_TONE_STYLES[tone],
});
