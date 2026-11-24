import type { ReactNode, Ref } from 'react';
import { Menu, Moon, PanelTop, Sun, X } from 'lucide-react';
import { IconButton } from './Button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from './Breadcrumb';

export type WorkspaceHeaderProps = {
  title: string;
  username?: string;
  theme: 'light' | 'dark';
  onNavigateHome: () => void;
  onToggleTheme: () => void;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  mobileMenuButtonRef?: Ref<HTMLButtonElement>;
  searchAction?: ReactNode;
  notificationsAction?: ReactNode;
  createAction?: ReactNode;
  accountAction?: ReactNode;
  roleLabel?: string;
};

/** Persistent workspace context, separate from each page's title and actions. */
export function WorkspaceHeader({
  title,
  username = 'Conta conectada',
  theme,
  onNavigateHome,
  onToggleTheme,
  mobileMenuOpen,
  onToggleMobileMenu,
  mobileMenuButtonRef,
  searchAction,
  notificationsAction,
  createAction,
  accountAction,
  roleLabel,
}: WorkspaceHeaderProps) {
  return <header className="kds-workspace-header">
    <div className="kds-workspace-header-mobile">
        <IconButton
          ref={mobileMenuButtonRef}
          variant="ghost"
          className="kds-workspace-mobile-menu-button"
          aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={mobileMenuOpen}
          aria-controls="painel-navigation"
          onClick={onToggleMobileMenu}
        >
          {mobileMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </IconButton>
      <span className="kds-workspace-mobile-title">{title}</span>
    </div>
    <div className="kds-workspace-breadcrumb">
      <Breadcrumb>
        <BreadcrumbItem><BreadcrumbLink onClick={onNavigateHome}><PanelTop aria-hidden="true" /> Workspace</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem isCurrent>{title}</BreadcrumbItem>
      </Breadcrumb>
    </div>
    {searchAction}
    <div className="kds-workspace-account">
      <IconButton variant="ghost" size="sm" className="kds-workspace-theme-toggle" aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'} onClick={onToggleTheme}>
        {theme === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
      </IconButton>
      {notificationsAction}
      {createAction}
      {accountAction ?? <span className="kds-workspace-username">{username}{roleLabel && <small>{roleLabel}</small>}</span>}
    </div>
  </header>;
}
