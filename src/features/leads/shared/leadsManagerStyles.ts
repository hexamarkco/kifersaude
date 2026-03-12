import type { CSSProperties } from "react";

export const LEADS_SECTION_STYLE: CSSProperties = {
  borderColor: "var(--panel-border,#d4c0a7)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--panel-surface,#fffdfa) 97%, white 3%) 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 92%, var(--panel-surface-soft,#efe6d8) 8%) 100%)",
  boxShadow: "0 26px 50px -38px rgba(26,18,13,0.38)",
};

export const LEADS_INSET_STYLE: CSSProperties = {
  borderColor: "var(--panel-border-subtle,#e4d5c0)",
  background:
    "color-mix(in srgb, var(--panel-surface,#fffdfa) 92%, transparent)",
};

export const LEADS_MUTED_INSET_STYLE: CSSProperties = {
  borderColor: "var(--panel-border-subtle,#e4d5c0)",
  background:
    "linear-gradient(180deg, color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 55%, transparent) 0%, color-mix(in srgb, var(--panel-surface,#fffdfa) 96%, transparent) 100%)",
};

export const LEADS_PILL_STYLE: CSSProperties = {
  borderColor: "var(--panel-border-subtle,#e4d5c0)",
  background:
    "color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 72%, transparent)",
};

export const LEADS_HERO_STYLE: CSSProperties = {
  borderColor: "var(--panel-border,#d4c0a7)",
  background:
    "linear-gradient(135deg, color-mix(in srgb, var(--panel-surface,#fffdfa) 92%, transparent) 0%, color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 82%, transparent) 100%), radial-gradient(circle at top right, rgba(212,120,42,0.2), transparent 34%), radial-gradient(circle at bottom left, rgba(120,72,34,0.18), transparent 42%)",
  boxShadow: "0 30px 54px -40px rgba(26,18,13,0.4)",
};

export const LEADS_EMPTY_STATE_STYLE: CSSProperties = {
  borderColor: "var(--panel-border-subtle,#e4d5c0)",
  background:
    "color-mix(in srgb, var(--panel-surface-soft,#efe6d8) 62%, transparent)",
  color: "var(--panel-text-muted,#876f5c)",
};
