import { cx } from '../lib/cx';

export type PanelButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'danger'
  | 'icon'
  | 'info'
  | 'success'
  | 'warning'
  | 'soft';

export type PanelButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export const panelButtonBaseClass =
  'panel-ui-button inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-[background-color,border-color,color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--panel-bg,#f8f5ef)] disabled:cursor-not-allowed disabled:opacity-60';

export const panelButtonVariantClasses: Record<PanelButtonVariant, string> = {
  primary:
    'border-[var(--panel-border-strong,#9d7f5a)] bg-[color:var(--panel-accent-soft,#f6e4c7)] text-[var(--panel-accent-ink,#6f3f16)] shadow-sm hover:border-[var(--panel-accent-strong,#b85c1f)] hover:bg-[color:var(--panel-accent-hover,#efcf9f)] hover:text-[var(--panel-accent-ink-strong,#4a2411)] focus-visible:ring-[color:var(--panel-focus,#c86f1d)] disabled:hover:bg-[color:var(--panel-accent-soft,#f6e4c7)]',
  secondary:
    'border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface,#fffdfa)] text-[var(--panel-text-soft,#5b4635)] shadow-sm hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[color:var(--panel-surface-soft,#f4ede3)] hover:text-[var(--panel-text,#1a120d)] focus-visible:ring-[color:var(--panel-focus,#c86f1d)] disabled:hover:bg-[color:var(--panel-surface,#fffdfa)]',
  ghost:
    'border-transparent bg-transparent text-[var(--panel-text-soft,#5b4635)] hover:border-[color:rgba(157,127,90,0.35)] hover:bg-[color:rgba(255,253,250,0.82)] hover:text-[var(--panel-text,#1a120d)] focus-visible:ring-[color:var(--panel-focus,#c86f1d)] disabled:hover:bg-transparent',
  danger:
    'border-[var(--panel-accent-red-border,#d79a8f)] bg-[var(--panel-accent-red-bg,#faecea)] text-[var(--panel-accent-red-text,#8a3128)] shadow-sm hover:bg-[var(--panel-accent-red-bg-strong,#f2d0ca)] focus-visible:ring-[color:var(--panel-accent-red-text,#8a3128)] disabled:hover:bg-[var(--panel-accent-red-bg,#faecea)]',
  icon:
    'border-transparent bg-transparent text-[var(--panel-text-muted,#876f5c)] hover:border-[color:rgba(157,127,90,0.32)] hover:bg-[color:rgba(255,253,250,0.78)] hover:text-[var(--panel-text,#1a120d)] focus-visible:ring-[color:var(--panel-focus,#c86f1d)] disabled:hover:bg-transparent',
  info:
    'border-[var(--panel-accent-blue-border,#a8c0d8)] bg-[var(--panel-accent-blue-bg,#edf3fb)] text-[var(--panel-accent-blue-text,#31577a)] shadow-sm hover:bg-[var(--panel-accent-blue-bg-strong,#dbe7f7)] focus-visible:ring-[color:var(--panel-accent-blue-text,#31577a)] disabled:hover:bg-[var(--panel-accent-blue-bg,#edf3fb)]',
  success:
    'border-[var(--panel-accent-green-border,#95c4a1)] bg-[var(--panel-accent-green-bg,#edf6ef)] text-[var(--panel-accent-green-text,#275c39)] shadow-sm hover:bg-[var(--panel-accent-green-bg-strong,#d6ead8)] focus-visible:ring-[color:var(--panel-accent-green-text,#275c39)] disabled:hover:bg-[var(--panel-accent-green-bg,#edf6ef)]',
  warning:
    'border-[var(--panel-accent-border,#d5a25c)] bg-[color:var(--panel-accent-warm,#f1d19d)] text-[var(--panel-accent-ink-strong,#4a2411)] shadow-sm hover:border-[var(--panel-accent-strong,#b85c1f)] hover:bg-[color:var(--panel-accent-hover,#efcf9f)] focus-visible:ring-[color:var(--panel-focus,#c86f1d)] disabled:hover:bg-[color:var(--panel-accent-warm,#f1d19d)]',
  soft:
    'border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface-muted,#f7f0e7)] text-[var(--panel-accent-ink,#6f3f16)] shadow-sm hover:border-[var(--panel-border-strong,#9d7f5a)] hover:bg-[color:var(--panel-accent-soft,#f6e4c7)] hover:text-[var(--panel-accent-ink-strong,#4a2411)] focus-visible:ring-[color:var(--panel-focus,#c86f1d)] disabled:hover:bg-[color:var(--panel-surface-muted,#f7f0e7)]',
};

export const panelButtonSizeClasses: Record<PanelButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
  icon: 'h-10 w-10 p-0',
};

export const panelButtonSpinnerSizeClasses: Record<PanelButtonSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-4 w-4',
  icon: 'h-4 w-4',
};

type PanelButtonClassOptions = {
  variant: PanelButtonVariant;
  size: PanelButtonSize;
  fullWidth?: boolean;
  className?: string;
};

export const getPanelButtonClass = ({
  variant,
  size,
  fullWidth = false,
  className,
}: PanelButtonClassOptions) =>
  cx(
    panelButtonBaseClass,
    `panel-ui-button-${variant}`,
    panelButtonVariantClasses[variant],
    panelButtonSizeClasses[size],
    fullWidth && 'w-full',
    className,
  );

export type PanelCardVariant = 'default' | 'glass' | 'strong' | 'interactive';
export type PanelCardPadding = 'none' | 'sm' | 'md' | 'lg';

export const panelCardBaseClass = 'rounded-xl';

export const panelCardVariantClasses: Record<PanelCardVariant, string> = {
  default: 'bg-[color:var(--panel-surface,#fffdfa)] border border-[var(--panel-border-subtle,#e7dac8)] shadow-sm',
  glass: 'panel-glass-panel border border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface,#fffdfa)]',
  strong: 'panel-glass-strong border border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface,#fffdfa)]',
  interactive:
    'panel-glass-panel panel-interactive-glass border border-[var(--panel-border-subtle,#e7dac8)] bg-[color:var(--panel-surface,#fffdfa)] hover:-translate-y-0.5',
};

export const panelCardPaddingClasses: Record<PanelCardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export type PanelInputSize = 'default' | 'compact';

export const panelInputBaseClass =
  'panel-ui-input w-full rounded-lg border border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface,#fffdfa)] px-3 shadow-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--panel-focus,#c86f1d)] disabled:cursor-not-allowed disabled:opacity-60';

export const panelInputStateClasses = {
  valid: 'border-[var(--panel-border,#d4c0a7)] text-[var(--panel-input-text,var(--panel-text-soft))] placeholder:text-[var(--panel-placeholder,var(--panel-text-muted))]',
  invalid: 'border-[var(--panel-accent-red-border,#d79a8f)] text-[var(--panel-accent-red-text,#8a3128)] placeholder:text-[var(--panel-accent-red-text,#8a3128)]',
};

export const panelInputSizeClasses: Record<PanelInputSize, string> = {
  default: 'h-11 text-sm',
  compact: 'h-9 text-xs',
};

export const panelInputIconSizeClasses: Record<PanelInputSize, string> = {
  default: 'h-[18px] w-[18px]',
  compact: 'h-4 w-4',
};

export type PanelCheckboxSize = 'sm' | 'md';

export const panelCheckboxBaseClass =
  'panel-ui-checkbox shrink-0 rounded border border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface,#fffdfa)] text-[var(--panel-accent-strong,#b85c1f)] shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panel-focus,#c86f1d)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--panel-bg,#f8f5ef)] disabled:cursor-not-allowed disabled:opacity-60';

export const panelCheckboxSizeClasses: Record<PanelCheckboxSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
};

export type PanelTabsVariant = 'underline' | 'pill' | 'panel';

const tabsListBaseClass = 'flex w-full flex-wrap';

const tabsListVariantClasses: Record<PanelTabsVariant, string> = {
  underline: 'gap-0 border-b border-[var(--panel-border-subtle,#e7dac8)] px-2 sm:px-4',
  pill: 'gap-2 rounded-xl bg-[color:var(--panel-surface-soft,#f4ede3)] p-1',
  panel: 'panel-glass-panel gap-1 rounded-xl border border-[var(--panel-border-subtle,#e7dac8)] p-[3px]',
};

const tabsTriggerBaseClass =
  'panel-ui-tab inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--panel-focus,#c86f1d)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const tabsTriggerVariantClasses: Record<PanelTabsVariant, { active: string; idle: string }> = {
  underline: {
    active:
      'panel-ui-tab-underline rounded-none border-b-2 border-[var(--panel-accent-strong,#b85c1f)] bg-[color:var(--panel-accent-soft,#f6e4c7)] px-3 py-4 text-[var(--panel-accent-ink,#6f3f16)]',
    idle:
      'panel-ui-tab-underline rounded-none border-b-2 border-transparent px-3 py-4 text-[var(--panel-text-muted,#876f5c)] hover:bg-[color:var(--panel-surface-soft,#f4ede3)] hover:text-[var(--panel-text,#1a120d)]',
  },
  pill: {
    active: 'panel-ui-tab-pill bg-[color:var(--panel-surface,#fffdfa)] text-[var(--panel-text,#1a120d)] shadow-sm',
    idle:
      'panel-ui-tab-pill text-[var(--panel-text-muted,#876f5c)] hover:bg-[color:rgba(255,253,250,0.72)] hover:text-[var(--panel-text,#1a120d)]',
  },
  panel: {
    active:
      'panel-ui-tab-panel h-9 bg-[color:var(--panel-surface-soft,#f4ede3)] px-3 py-0 text-[var(--panel-accent-ink,#6f3f16)] shadow-sm',
    idle:
      'panel-ui-tab-panel h-9 px-3 py-0 text-[var(--panel-text-muted,#876f5c)] hover:bg-[color:rgba(255,253,250,0.72)] hover:text-[var(--panel-text,#1a120d)]',
  },
};

type PanelTabsClassOptions = {
  variant: PanelTabsVariant;
  isActive: boolean;
  className?: string;
};

export const getPanelTabsListClass = (variant: PanelTabsVariant, className?: string) =>
  cx(tabsListBaseClass, tabsListVariantClasses[variant], className);

export const getPanelTabsTriggerClass = ({ variant, isActive, className }: PanelTabsClassOptions) =>
  cx(tabsTriggerBaseClass, tabsTriggerVariantClasses[variant][isActive ? 'active' : 'idle'], className);

export const panelTabsBadgeClass =
  'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[color:var(--panel-accent-soft,#f6e4c7)] px-1.5 text-xs font-semibold text-[var(--panel-accent-ink,#6f3f16)]';
