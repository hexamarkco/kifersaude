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
    'focus:border-transparent focus:ring-2 focus:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-60',
    compact ? 'h-8 pl-8 pr-8 text-xs' : 'h-11 pl-10 pr-10 text-sm',
    isDark ? 'border-amber-700/70 bg-stone-950 text-stone-100' : 'border-slate-300 bg-white text-slate-700',
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
      ? 'panel-dropdown-dark border-amber-700/70 bg-stone-950 text-stone-100'
      : 'border-slate-200 bg-white text-slate-700',
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
        ? 'bg-amber-500/20 font-medium text-amber-200'
        : 'bg-amber-50 font-medium text-amber-700'
      : highlighted
        ? isDark
          ? 'bg-stone-800 text-stone-100'
          : 'bg-slate-100 text-slate-700'
        : isDark
          ? 'text-stone-200 hover:bg-stone-800'
          : 'text-slate-700 hover:bg-slate-100',
    className,
  );

export const getDropdownActionClass = (isDark: boolean) =>
  cx(
    'w-full px-3 py-2 text-left text-sm font-medium transition-colors',
    isDark ? 'text-amber-300 hover:bg-stone-800' : 'text-amber-600 hover:bg-slate-50',
  );
