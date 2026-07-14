import type { CSSProperties } from 'react';

export const PANEL_SECTION_STYLE: CSSProperties = {
  borderColor: 'var(--border-default)',
  background: 'var(--bg-surface)',
  boxShadow: 'var(--shadow-card)',
};

export const PANEL_INSET_STYLE: CSSProperties = {
  borderColor: 'var(--border-subtle)',
  background: 'var(--bg-inset)',
};

export const PANEL_MUTED_INSET_STYLE: CSSProperties = {
  borderColor: 'var(--border-subtle)',
  background: 'var(--bg-surface-muted)',
};

export const PANEL_PILL_STYLE: CSSProperties = {
  borderColor: 'var(--border-default)',
  background: 'var(--bg-elevated)',
};

export const PANEL_HERO_STYLE: CSSProperties = {
  borderColor: 'var(--border-accent)',
  background: 'var(--surface-hero-bg)',
  boxShadow: 'var(--shadow-card)',
};

export const PANEL_EMPTY_STATE_STYLE: CSSProperties = {
  borderColor: 'var(--border-subtle)',
  background: 'var(--bg-inset)',
  color: 'var(--text-muted)',
};

export type PanelTone = 'neutral' | 'accent' | 'gold' | 'info' | 'success' | 'warning' | 'danger';

const PANEL_TONE_STYLES: Record<PanelTone, CSSProperties> = {
  neutral: {
    borderColor: 'var(--border-default)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
  },
  accent: {
    borderColor: 'var(--brand-primary-border)',
    background: 'var(--brand-primary-soft)',
    color: 'var(--badge-accent-text)',
  },
  gold: {
    borderColor: 'var(--accent-gold-border)',
    background: 'var(--accent-gold-soft)',
    color: 'var(--accent-gold-hover)',
  },
  info: {
    borderColor: 'var(--info-border)',
    background: 'var(--info-soft)',
    color: 'var(--info-text)',
  },
  success: {
    borderColor: 'var(--success-border)',
    background: 'var(--success-soft)',
    color: 'var(--success-text)',
  },
  warning: {
    borderColor: 'var(--warning-border)',
    background: 'var(--warning-soft)',
    color: 'var(--warning-text)',
  },
  danger: {
    borderColor: 'var(--danger-border)',
    background: 'var(--danger-soft)',
    color: 'var(--danger-text)',
  },
};

export const getPanelToneStyle = (tone: PanelTone): CSSProperties => ({
  ...PANEL_TONE_STYLES[tone],
});
