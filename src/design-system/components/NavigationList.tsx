import type { LucideIcon } from 'lucide-react';

export type NavigationItem = {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
};

export type NavigationListProps = {
  items: readonly NavigationItem[];
  activeId: string;
  ariaLabel: string;
  onNavigate?: (id: string) => void;
};

/** Navigation remains real links, including browser history and open-in-new-tab. */
export function NavigationList({
  items,
  activeId,
  ariaLabel,
  onNavigate,
}: NavigationListProps) {
  return (
    <nav className="kds-navigation-list" aria-label={ariaLabel}>
      {items.map(({ id, label, href, icon: Icon }) => (
        <a
          key={id}
          href={href}
          aria-current={activeId === id ? 'page' : undefined}
          onClick={(event) => {
            if (
              onNavigate &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.shiftKey &&
              !event.altKey &&
              event.button === 0
            ) {
              event.preventDefault();
              onNavigate(id);
            }
          }}
        >
          {Icon && <Icon size={18} aria-hidden="true" />}
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
