import { cx } from '../../lib/cx';

type TriggerOptions = {
  isDark: boolean;
  compact?: boolean;
  className?: string;
};

type MenuOptions = {
  isDark: boolean;
  position?: 'fixed' | 'absolute';
  className?: string;
};

type OptionOptions = {
  isDark: boolean;
  selected?: boolean;
  highlighted?: boolean;
  compact?: boolean;
  className?: string;
};

export const isPanelDarkTheme = () => {
  if (typeof document === 'undefined') {
    return false;
  }

  if (document.querySelector('.painel-theme.theme-dark')) {
    return true;
  }

  if (document.querySelector('.painel-theme.theme-light')) {
    return false;
  }

  const storedTheme = window.localStorage.getItem('painel.theme.v1');
  if (storedTheme === 'dark') {
    return true;
  }

  if (storedTheme === 'light') {
    return false;
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches;
};

export const getDropdownTriggerClass = ({
  compact = false,
  className,
}: TriggerOptions) =>
  cx(
    'kds-select kds-select-trigger kds-filter-trigger panel-ui-input relative w-full border text-left shadow-none',
    'focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
    compact ? 'h-9 pl-8 pr-8 text-xs' : 'h-12 pl-10 pr-10 text-sm',
    className,
  );

export const getDropdownMenuClass = ({
  position = 'fixed',
  className,
}: MenuOptions) =>
  cx(
    'kds-dropdown-menu panel-dropdown-scrollbar z-[160] overflow-y-auto border p-1.5 shadow-xl',
    position,
    className,
  );

export const getDropdownOptionClass = ({
  selected = false,
  highlighted = false,
  compact = false,
  className,
}: OptionOptions) =>
  cx(
    'kds-dropdown-option flex w-full items-center justify-between text-left transition-colors',
    compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2.5 text-sm',
    selected && 'is-selected font-medium',
    highlighted && 'is-highlighted',
    className,
  );

export const getDropdownActionClass = (isDark: boolean) => {
  void isDark;

  return cx(
    'w-full rounded-[var(--radius-md)] px-3 py-2 text-left text-sm font-medium transition-colors',
    'text-[var(--brand-primary-hover)] hover:bg-[var(--brand-primary-muted)] hover:text-[var(--accent-gold-hover)]',
  );
};
