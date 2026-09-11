import { cx } from '../lib/cx';

export const KIFER_THEME_COLORS = {
  darkCanvas: '#16110c',
  lightCanvas: '#f4f0e7',
} as const;

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

export type ControlSize = 'sm' | 'md' | 'lg';
export type PanelButtonSize = ControlSize;

export const panelButtonBaseClass =
  'kds-button panel-ui-button inline-flex items-center justify-center border focus-visible:outline-none disabled:cursor-not-allowed';

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
  sm: 'kds-control-sm',
  md: 'kds-control-md',
  lg: 'kds-control-lg',
};

export const panelIconButtonSizeClasses: Record<ControlSize, string> = {
  sm: 'kds-control-sm kds-icon-button-sm',
  md: 'kds-control-md kds-icon-button-md',
  lg: 'kds-control-lg kds-icon-button-lg',
};

export const panelButtonSpinnerSizeClasses: Record<PanelButtonSize, string> = {
  sm: 'kds-control-icon',
  md: 'kds-control-icon',
  lg: 'kds-control-icon',
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
  sm: 'kds-card-padding-sm',
  md: 'kds-card-padding-md',
  lg: 'kds-card-padding-lg',
};

export type PanelInputSize = ControlSize;
export type PanelInputState = 'default' | 'error' | 'success';

export const panelInputBaseClass =
  'kds-input panel-ui-input w-full shadow-none disabled:cursor-not-allowed';

export const panelInputStateClasses: Record<PanelInputState | 'valid' | 'invalid', string> = {
  default: 'kds-input-valid',
  valid: 'kds-input-valid',
  error: 'kds-input-error',
  invalid: 'kds-input-invalid',
  success: 'kds-input-success',
};

export const panelInputSizeClasses: Record<PanelInputSize, string> = {
  sm: 'kds-control-sm',
  md: 'kds-control-md',
  lg: 'kds-control-lg',
};

export const panelInputIconSizeClasses: Record<PanelInputSize, string> = {
  sm: 'kds-control-icon',
  md: 'kds-control-icon',
  lg: 'kds-control-icon',
};

export type PanelCheckboxSize = 'sm' | 'md';

export const panelCheckboxBaseClass =
  'kds-checkbox panel-ui-checkbox shrink-0 border shadow-none transition-[background-color,border-color,box-shadow] duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60';

export const panelCheckboxSizeClasses: Record<PanelCheckboxSize, string> = {
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
};

export type PanelTabsVariant = 'underline' | 'pill' | 'rail';
export type PanelTabsSize = ControlSize;

const tabsListBaseClass = 'kds-tabs-list';

const tabsListVariantClasses: Record<PanelTabsVariant, string> = {
  underline: 'kds-tabs-list-underline',
  pill: 'kds-tabs-list-pill',
  rail: 'kds-tabs-list-rail',
};

const tabsTriggerBaseClass =
  'kds-tab inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring-strong)] disabled:cursor-not-allowed disabled:opacity-50';

const tabsTriggerSizeClasses: Record<PanelTabsSize, string> = {
  sm: 'kds-control-sm',
  md: 'kds-control-md',
  lg: 'kds-control-lg',
};

const tabsTriggerVariantClasses: Record<PanelTabsVariant, { active: string; idle: string }> = {
  underline: {
    active: 'kds-tab-underline kds-tab-active',
    idle: 'kds-tab-underline',
  },
  pill: {
    active: 'kds-tab-active',
    idle: '',
  },
  rail: {
    active: 'kds-tab-rail kds-tab-active',
    idle: 'kds-tab-rail',
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
