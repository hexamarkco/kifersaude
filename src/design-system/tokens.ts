import { cx } from '../lib/cx';

export type PanelButtonVariant =
  | 'primary'
  | 'secondary'
  | 'gold'
  | 'tertiary'
  | 'text'
  | 'ghost'
  | 'danger'
  | 'destructive'
  | 'icon'
  | 'info'
  | 'success'
  | 'warning'
  | 'soft';

export type PanelButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'icon';

export const panelButtonBaseClass =
  'kds-button panel-ui-button inline-flex items-center justify-center gap-2 border focus-visible:outline-none disabled:cursor-not-allowed';

export const panelButtonVariantClasses: Record<PanelButtonVariant, string> = {
  primary: 'kds-button-primary',
  secondary: 'kds-button-secondary',
  gold: 'kds-button-gold',
  tertiary: 'kds-button-tertiary',
  text: 'kds-button-text',
  ghost: 'kds-button-ghost',
  danger: 'kds-button-danger',
  destructive: 'kds-button-destructive',
  icon: 'kds-button-icon',
  info: 'kds-button-info',
  success: 'kds-button-success',
  warning: 'kds-button-warning',
  soft: 'kds-button-soft',
};

export const panelButtonSizeClasses: Record<PanelButtonSize, string> = {
  xs: 'h-8 px-2.5 text-xs',
  sm: 'h-10 px-3.5 text-sm',
  md: 'h-10 px-3.5 text-sm',
  lg: 'h-12 px-4 text-sm',
  icon: 'h-10 w-10 p-0',
};

export const panelButtonSpinnerSizeClasses: Record<PanelButtonSize, string> = {
  xs: 'h-3.5 w-3.5',
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
    panelButtonVariantClasses[variant],
    panelButtonSizeClasses[size],
    fullWidth && 'w-full',
    className,
  );

export type PanelCardVariant = 'default' | 'muted' | 'glass' | 'strong' | 'interactive';
export type PanelCardPadding = 'none' | 'sm' | 'md' | 'lg';
export type PanelCardKind =
  | 'base'
  | 'kpi'
  | 'customer'
  | 'client'
  | 'opportunity'
  | 'lead'
  | 'activity'
  | 'task'
  | 'summary'
  | 'chart';

export const panelCardBaseClass = 'kds-card';

export const panelCardVariantClasses: Record<PanelCardVariant, string> = {
  default: 'kds-card-default',
  muted: 'kds-card-muted',
  glass: 'kds-card-glass',
  strong: 'kds-card-strong',
  interactive: 'kds-card-default kds-card-interactive',
};

export const panelCardKindClasses: Record<PanelCardKind, string> = {
  base: '',
  kpi: 'kds-card-kpi',
  customer: 'kds-card-customer',
  client: 'kds-card-customer',
  opportunity: 'kds-card-opportunity',
  lead: 'kds-card-lead',
  activity: 'kds-card-activity',
  task: 'kds-card-task',
  summary: 'kds-card-summary',
  chart: 'kds-card-chart',
};

export const panelCardPaddingClasses: Record<PanelCardPadding, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

export type PanelInputSize = 'default' | 'compact' | 'large';
export type PanelInputState = 'default' | 'error' | 'success';

export const panelInputBaseClass =
  'kds-input panel-ui-input w-full px-3 shadow-none disabled:cursor-not-allowed';

export const panelInputStateClasses: Record<PanelInputState | 'valid' | 'invalid', string> = {
  default: 'kds-input-valid',
  valid: 'kds-input-valid',
  error: 'kds-input-error',
  invalid: 'kds-input-invalid',
  success: 'kds-input-success',
};

export const panelInputSizeClasses: Record<PanelInputSize, string> = {
  default: 'h-10 text-sm',
  compact: 'h-8 text-xs',
  large: 'h-12 text-base',
};

export const panelInputIconSizeClasses: Record<PanelInputSize, string> = {
  default: 'h-[18px] w-[18px]',
  compact: 'h-4 w-4',
  large: 'h-5 w-5',
};

export type PanelCheckboxSize = 'sm' | 'md';

export const panelCheckboxBaseClass =
  'kds-checkbox panel-ui-checkbox shrink-0 border shadow-none transition-[background-color,border-color,box-shadow] duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60';

export const panelCheckboxSizeClasses: Record<PanelCheckboxSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
};

export type PanelTabsVariant = 'underline' | 'pill';
export type PanelTabsSize = 'sm' | 'md' | 'lg';

const tabsListBaseClass = 'kds-tabs-list';

const tabsListVariantClasses: Record<PanelTabsVariant, string> = {
  underline: 'kds-tabs-list-underline',
  pill: 'kds-tabs-list-pill',
};

const tabsTriggerBaseClass =
  'kds-tab inline-flex items-center justify-center gap-2 px-4 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-strong)] disabled:cursor-not-allowed disabled:opacity-50';

const tabsTriggerSizeClasses: Record<PanelTabsSize, string> = {
  sm: 'h-8 text-xs',
  md: 'h-10 text-sm',
  lg: 'h-12 text-sm',
};

const tabsTriggerVariantClasses: Record<PanelTabsVariant, { active: string; idle: string }> = {
  underline: {
    active: 'kds-tab-underline kds-tab-active px-3 py-2.5',
    idle: 'kds-tab-underline px-3 py-2.5',
  },
  pill: {
    active: 'kds-tab-active',
    idle: '',
  },
};

type PanelTabsClassOptions = {
  variant: PanelTabsVariant;
  isActive: boolean;
  size?: PanelTabsSize;
  className?: string;
};

export const getPanelTabsListClass = (variant: PanelTabsVariant, className?: string) =>
  cx(tabsListBaseClass, tabsListVariantClasses[variant], className);

export const getPanelTabsTriggerClass = ({ variant, isActive, size = 'md', className }: PanelTabsClassOptions) =>
  cx(tabsTriggerBaseClass, tabsTriggerSizeClasses[size], tabsTriggerVariantClasses[variant][isActive ? 'active' : 'idle'], className);

export const panelTabsBadgeClass = 'kds-tabs-badge';
