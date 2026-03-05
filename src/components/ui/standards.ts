import { cx } from '../../lib/cx';

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
  'panel-ui-button inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60';

export const panelButtonVariantClasses: Record<PanelButtonVariant, string> = {
  primary: 'bg-teal-600 text-white shadow-sm hover:bg-teal-700 focus-visible:ring-teal-500 disabled:hover:bg-teal-600',
  secondary:
    'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 focus-visible:ring-teal-500 disabled:hover:bg-white',
  ghost:
    'text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-teal-500 disabled:hover:bg-transparent',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-500 disabled:hover:bg-red-600',
  icon:
    'text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-teal-500 disabled:hover:bg-transparent',
  info: 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 focus-visible:ring-blue-500 disabled:hover:bg-blue-600',
  success:
    'border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm hover:bg-emerald-100 focus-visible:ring-emerald-500 disabled:hover:bg-emerald-50',
  warning:
    'border border-amber-200 bg-amber-100 text-amber-700 shadow-sm hover:bg-amber-200 focus-visible:ring-amber-500 disabled:hover:bg-amber-100',
  soft:
    'border border-teal-200 bg-teal-50 text-teal-700 shadow-sm hover:bg-teal-100 focus-visible:ring-teal-500 disabled:hover:bg-teal-50',
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
  default: 'bg-white border border-slate-200 shadow-sm',
  glass: 'panel-glass-panel border border-slate-200 bg-white',
  strong: 'panel-glass-strong border border-slate-200 bg-white',
  interactive: 'panel-glass-panel panel-interactive-glass border border-slate-200 bg-white hover:-translate-y-0.5',
};

export const panelCardPaddingClasses: Record<PanelCardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export type PanelInputSize = 'default' | 'compact';

export const panelInputBaseClass =
  'panel-ui-input w-full rounded-lg border bg-white px-3 shadow-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:cursor-not-allowed disabled:opacity-60';

export const panelInputStateClasses = {
  valid: 'border-slate-300 text-slate-700 placeholder:text-slate-400',
  invalid: 'border-red-400 text-red-700 placeholder:text-red-300',
};

export const panelInputSizeClasses: Record<PanelInputSize, string> = {
  default: 'h-11 text-sm',
  compact: 'h-9 text-xs',
};

export const panelInputIconSizeClasses: Record<PanelInputSize, string> = {
  default: 'h-[18px] w-[18px]',
  compact: 'h-4 w-4',
};

export type PanelTabsVariant = 'underline' | 'pill' | 'panel';

const tabsListBaseClass = 'flex w-full flex-wrap';

const tabsListVariantClasses: Record<PanelTabsVariant, string> = {
  underline: 'gap-0 border-b border-slate-200 px-2 sm:px-4',
  pill: 'gap-2 rounded-xl bg-slate-100 p-1',
  panel: 'panel-glass-panel gap-1 rounded-xl border border-slate-200 p-1',
};

const tabsTriggerBaseClass =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';

const tabsTriggerVariantClasses: Record<PanelTabsVariant, { active: string; idle: string }> = {
  underline: {
    active: 'rounded-none border-b-2 border-teal-600 bg-teal-50/70 px-3 py-4 text-teal-700',
    idle: 'rounded-none border-b-2 border-transparent px-3 py-4 text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  },
  pill: {
    active: 'bg-white text-slate-900 shadow-sm',
    idle: 'text-slate-600 hover:bg-white/70 hover:text-slate-900',
  },
  panel: {
    active: 'bg-slate-100 text-teal-700 shadow-sm',
    idle: 'text-slate-500 hover:bg-white/70 hover:text-slate-900',
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
  'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-teal-100 px-1.5 text-xs font-semibold text-teal-700';
