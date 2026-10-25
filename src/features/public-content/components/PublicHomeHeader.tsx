import { TextLink } from '../../../design-system';
import { useEffect, useId, useState, type MouseEvent } from 'react';
import { Menu } from 'lucide-react';

import PublicBrandMark from '../../../components/public/PublicBrandMark';
import { Button, DialogTitle, Drawer, DrawerBody, DrawerFooter, DrawerHeader, IconButton } from '../../../design-system';

const navigationItems = [
  { section: 'prova-social', label: 'Operadoras' },
  { section: 'para-quem', label: 'Para quem é' },
  { section: 'como-funciona', label: 'Como funciona' },
  { section: 'depoimentos', label: 'Depoimentos' },
  { section: 'faq', label: 'Dúvidas' },
] as const;

type PublicHomeHeaderProps = {
  onNavigate: (section: string) => void;
  onRequestQuote: () => void;
};

export default function PublicHomeHeader({ onNavigate, onRequestQuote }: PublicHomeHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);

  const navigate = (event: MouseEvent<HTMLAnchorElement>, section: string) => {
    event.preventDefault();
    setMenuOpen(false);
    onNavigate(section);
  };

  const requestQuote = () => {
    setMenuOpen(false);
    onRequestQuote();
  };

  return (
    <>
      <header className="kds-public-header">
        <div className="kds-public-header-inner">
          <TextLink
            href="#topo"
            onClick={(event) => navigate(event, 'topo')}
            aria-label="Kifer Saúde, início"
            className="kds-public-header-brand"
          >
            <PublicBrandMark className="kds-public-header-mark" />
            <span className="kds-public-header-wordmark">Kifer Saúde</span>
          </TextLink>

          <nav aria-label="Navegação principal" className="kds-public-header-navigation">
            {navigationItems.map(({ section, label }) => (
              <TextLink key={section} href={`#${section}`} onClick={(event) => navigate(event, section)}>
                {label}
              </TextLink>
            ))}
          </nav>

          <div className="kds-public-header-actions">
            <Button type="button" variant="primary" size="lg" onClick={requestQuote}>
              Cotação grátis
            </Button>
            <div className="kds-public-header-toggle">
              <IconButton
                type="button"
                variant="ghost"
                size="lg"
                aria-label="Abrir menu"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                aria-haspopup="dialog"
                onClick={() => setMenuOpen(true)}
              >
                <Menu aria-hidden="true" className="kds-control-icon" />
              </IconButton>
            </div>
          </div>
        </div>
      </header>

      <Drawer id={menuId} open={menuOpen} onOpenChange={setMenuOpen} side="right" size="sm">
        <DrawerHeader onClose={() => setMenuOpen(false)}>
          <DialogTitle>Menu</DialogTitle>
        </DrawerHeader>
        <DrawerBody>
          <nav aria-label="Navegação móvel" className="kds-public-mobile-navigation">
            {navigationItems.map(({ section, label }) => (
              <TextLink key={section} href={`#${section}`} onClick={(event) => navigate(event, section)}>
                {label}
              </TextLink>
            ))}
          </nav>
        </DrawerBody>
        <DrawerFooter>
          <Button type="button" variant="primary" size="lg" fullWidth onClick={requestQuote}>
            Cotação grátis
          </Button>
        </DrawerFooter>
      </Drawer>
    </>
  );
}
