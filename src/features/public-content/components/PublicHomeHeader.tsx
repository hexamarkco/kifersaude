import { TextLink } from "../../../design-system";
import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { ArrowUpRight, Menu } from "lucide-react";
import { homeNavigation } from "../domain/homeContent";
import HomeBrand from "./home/HomeBrand";

import {
  Button,
  DialogTitle,
  Drawer,
  DrawerBody,
  DrawerFooter,
  DrawerHeader,
  IconButton,
  LinkButton,
} from "../../../design-system";

const navigationItems = homeNavigation;

type PublicHomeHeaderProps = {
  onNavigate?: (section: string) => void;
  onRequestQuote?: () => void;
};

export default function PublicHomeHeader({
  onNavigate,
  onRequestQuote,
}: PublicHomeHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const afterMenuClose = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (menuOpen) return;
    // The drawer restores focus and the scrollbar before measuring the anchor.
    const action = afterMenuClose.current;
    afterMenuClose.current = null;
    action?.();
  }, [menuOpen]);

  useEffect(() => {
    const desktop = window.matchMedia?.("(min-width: 851px)");
    if (!desktop) return;
    const closeOnDesktop = () => {
      if (desktop.matches) setMenuOpen(false);
    };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const closeMenuAndRun = (action: () => void) => {
    if (menuOpen) {
      afterMenuClose.current = action;
      setMenuOpen(false);
    } else action();
  };

  const navigate = (event: MouseEvent<HTMLAnchorElement>, section: string) => {
    if (!onNavigate) return;
    event.preventDefault();
    closeMenuAndRun(() => onNavigate(section));
  };

  const requestQuote = () => {
    if (onRequestQuote) closeMenuAndRun(onRequestQuote);
  };
  const homeSectionHref = (section: string) => `${onNavigate ? "" : "/"}#${section}`;

  return (
    <>
      <header className="header" id="topo">
        <div className="wrap">
          <TextLink
            href={onNavigate ? "#topo" : "/"}
            onClick={(event) => navigate(event, "topo")}
            aria-label="Kifer Saúde, início"
            className="header-brand"
          >
            <HomeBrand />
          </TextLink>

          <nav aria-label="Navegação principal">
            {navigationItems.map(({ section, label }) => (
              <TextLink
                key={section}
                href={homeSectionHref(section)}
                onClick={(event) => navigate(event, section)}
              >
                {label}
              </TextLink>
            ))}
          </nav>

          <div className="header-actions">
            {onRequestQuote ? <Button
              type="button"
              variant="primary"
              size="lg"
              className="button"
              onClick={requestQuote}
            >
              Quero uma cotação
              <ArrowUpRight aria-hidden="true" />
            </Button> : <LinkButton href="/#cotacao" variant="primary" size="lg" className="button">
              Quero uma cotação
              <ArrowUpRight aria-hidden="true" />
            </LinkButton>}
            <div className="header-toggle">
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

      <Drawer
        id={menuId}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        side="right"
        size="sm"
        className="home-mobile-drawer"
      >
        <DrawerHeader onClose={() => setMenuOpen(false)}>
          <DialogTitle>Menu</DialogTitle>
        </DrawerHeader>
        <DrawerBody>
          <nav
            aria-label="Navegação móvel"
            className="kds-public-mobile-navigation"
          >
            {navigationItems.map(({ section, label }) => (
              <TextLink
                key={section}
                href={homeSectionHref(section)}
                onClick={(event) => navigate(event, section)}
              >
                {label}
              </TextLink>
            ))}
          </nav>
        </DrawerBody>
        <DrawerFooter>
          {onRequestQuote ? <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={requestQuote}
          >
            Cotação grátis
          </Button> : <LinkButton href="/#cotacao" variant="primary" size="lg" className="w-full">
            Cotação grátis
          </LinkButton>}
        </DrawerFooter>
      </Drawer>
    </>
  );
}
