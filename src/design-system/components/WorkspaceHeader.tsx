import type { Ref } from 'react';
import { Menu, Moon, Sun, X } from 'lucide-react';
import Avatar from './Avatar';
import { IconButton } from './Button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from './Breadcrumb';
import { BrandWordmark } from './BrandWordmark';

export type WorkspaceHeaderProps = {
  title: string;
  username?: string;
  theme: 'light' | 'dark';
  onNavigateHome: () => void;
  onToggleTheme: () => void;
  mobileMenuOpen: boolean;
  onToggleMobileMenu: () => void;
  mobileMenuButtonRef?: Ref<HTMLButtonElement>;
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
}: WorkspaceHeaderProps) {
  return <header className="kds-workspace-header">
    <div className="kds-workspace-header-desktop">
      <Breadcrumb>
        <BreadcrumbItem><BreadcrumbLink onClick={onNavigateHome}>CRM</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem isCurrent>{title}</BreadcrumbItem>
      </Breadcrumb>
      <div className="kds-workspace-account">
        <span className="kds-workspace-username">{username}</span>
        <IconButton variant="ghost" aria-label={theme === 'light' ? 'Ativar tema escuro' : 'Ativar tema claro'} onClick={onToggleTheme}>
          {theme === 'light' ? <Moon aria-hidden="true" /> : <Sun aria-hidden="true" />}
        </IconButton>
        <Avatar name={username} size="sm" tone="brand" />
      </div>
    </div>
    <div className="kds-workspace-header-mobile">
      <BrandWordmark className="kds-workspace-mobile-brand" />
      <div className="kds-workspace-mobile-actions">
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
        <Avatar name={username} size="sm" tone="brand" />
      </div>
    </div>
  </header>;
}
