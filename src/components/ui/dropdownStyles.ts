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
  isDark,
  compact = false,
  className,
}: TriggerOptions) =>
  cx(
    'panel-glass-panel panel-interactive-glass relative w-full rounded-lg border text-left transition-shadow',
    'focus:border-transparent focus:ring-2 focus:ring-[color:var(--panel-focus,#c86f1d)] disabled:cursor-not-allowed disabled:opacity-60',
    compact ? 'h-8 pl-8 pr-8 text-xs' : 'h-11 pl-10 pr-10 text-sm',
    isDark
      ? 'border-[var(--panel-border-strong,#9d7f5a)] bg-[color:var(--panel-surface,#1b1611)] text-[var(--panel-input-text,var(--panel-text))]'
      : 'border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface,#fffdfa)] text-[var(--panel-input-text,var(--panel-text-soft))]',
    className,
  );

export const getDropdownMenuClass = ({
  isDark,
  position = 'fixed',
  className,
}: MenuOptions) =>
  cx(
    'panel-glass-panel panel-dropdown-scrollbar z-[110] overflow-y-auto rounded-lg border shadow-xl',
    position,
    isDark
      ? 'panel-dropdown-dark border-[var(--panel-border-strong,#9d7f5a)] bg-[color:var(--panel-surface,#1b1611)] text-[var(--panel-text,#f7efe5)]'
      : 'border-[var(--panel-border,#d4c0a7)] bg-[color:var(--panel-surface,#fffdfa)] text-[var(--panel-text-soft,#5b4635)]',
    className,
  );

export const getDropdownOptionClass = ({
  isDark,
  selected = false,
  highlighted = false,
  compact = false,
  className,
}: OptionOptions) =>
  cx(
    'flex w-full items-center justify-between px-3 text-left transition-colors',
    compact ? 'py-1.5 text-xs' : 'py-2 text-sm',
    selected
      ? isDark
        ? 'bg-[color:var(--panel-accent-soft,#4a2a14)] font-medium text-[var(--panel-accent-foreground,#f7d7b4)]'
        : 'bg-[color:var(--panel-accent-soft,#f6e4c7)] font-medium text-[var(--panel-accent-ink,#6f3f16)]'
      : highlighted
        ? isDark
          ? 'bg-[color:var(--panel-surface-soft,#2a1d15)] text-[var(--panel-text,#f7efe5)]'
          : 'bg-[color:var(--panel-surface-soft,#f4ede3)] text-[var(--panel-text,#1a120d)]'
        : isDark
          ? 'text-[var(--panel-text,#f7efe5)] hover:bg-[color:var(--panel-surface-soft,#2a1d15)]'
          : 'text-[var(--panel-text-soft,#5b4635)] hover:bg-[color:var(--panel-surface-soft,#f4ede3)]',
    className,
  );

export const getDropdownActionClass = (isDark: boolean) =>
  cx(
    'w-full px-3 py-2 text-left text-sm font-medium transition-colors',
    isDark
      ? 'text-[var(--panel-accent-foreground,#f7d7b4)] hover:bg-[color:var(--panel-surface-soft,#2a1d15)]'
      : 'text-[var(--panel-accent-ink,#6f3f16)] hover:bg-[color:var(--panel-surface-soft,#f4ede3)]',
  );
