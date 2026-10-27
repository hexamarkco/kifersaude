import { Moon, Sun } from 'lucide-react';
import Avatar from './Avatar';
import { IconButton } from './Button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbSeparator } from './Breadcrumb';

export type WorkspaceHeaderProps = {
  title: string;
  username?: string;
  theme: 'light' | 'dark';
  onNavigateHome: () => void;
  onToggleTheme: () => void;
};

/** Persistent workspace context, separate from each page's title and actions. */
export function WorkspaceHeader({ title, username = 'Conta conectada', theme, onNavigateHome, onToggleTheme }: WorkspaceHeaderProps) {
  return <header className="kds-workspace-header">
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
  </header>;
}
