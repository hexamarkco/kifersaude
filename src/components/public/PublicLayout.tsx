import { ReactNode, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ArrowUpRight, Heart, Mail, MapPin, Menu, MessageCircle, Phone, X } from 'lucide-react';
import { usePanelMotion } from '../../hooks/usePanelMotion';

type PublicLayoutProps = {
  children: ReactNode;
};

type NavigationItem = {
  label: string;
  to: string;
  end?: boolean;
};

const navigationItems: NavigationItem[] = [
  { label: 'Inicio', to: '/', end: true },
  { label: 'Planos', to: '/planos' },
  { label: 'Operadoras', to: '/operadoras' },
  { label: 'Como funciona', to: '/como-funciona' },
  { label: 'Sobre', to: '/sobre' },
  { label: 'Depoimentos', to: '/depoimentos' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Contato', to: '/contato' },
  { label: 'Blog', to: '/blog' },
];

const usefulLinks = [
  { label: 'Solicitar cotacao', to: '/cotacao' },
  { label: 'Plano pessoa fisica', to: '/planos/pessoa-fisica' },
  { label: 'Plano familiar', to: '/planos/familia' },
  { label: 'Plano MEI/CNPJ', to: '/planos/mei-cnpj' },
  { label: 'Portabilidade', to: '/portabilidade' },
  { label: 'Operadoras parceiras', to: '/operadoras' },
  { label: 'Perguntas frequentes', to: '/faq' },
  { label: 'Politica de privacidade', to: '/politica-de-privacidade' },
  { label: 'Termos de uso', to: '/termos-de-uso' },
];

const navLinkClassName = (isActive: boolean) =>
  [
    'rounded-full px-4 py-2 text-sm font-semibold transition-all',
    isActive
      ? 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-900 shadow-sm'
      : 'text-slate-600 hover:bg-white hover:text-slate-900',
  ].join(' ');

export default function PublicLayout({ children }: PublicLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const location = useLocation();
  const headerRef = useRef<HTMLElement | null>(null);
  const mainRef = useRef<HTMLElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const floatingWhatsAppRef = useRef<HTMLAnchorElement | null>(null);
  const mobileWhatsAppBarRef = useRef<HTMLDivElement | null>(null);
  const { motionEnabled, sectionDuration, sectionStagger, microDuration, revealDistance, ease } = usePanelMotion();

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const header = headerRef.current;
    const floatingCta = floatingWhatsAppRef.current;
    const mobileBar = mobileWhatsAppBarRef.current;

    if (!motionEnabled) {
      if (header) {
        gsap.set(header, { autoAlpha: 1, y: 0, clearProps: 'transform,opacity,willChange' });
      }
      if (floatingCta) {
        gsap.set(floatingCta, { autoAlpha: 1, y: 0, scale: 1, clearProps: 'transform,opacity,willChange' });
      }
      if (mobileBar) {
        gsap.set(mobileBar, { autoAlpha: 1, y: 0, clearProps: 'transform,opacity,willChange' });
      }
      return;
    }

    const timeline = gsap.timeline({
      defaults: {
        ease: 'power2.out',
        overwrite: 'auto',
      },
    });

    if (header) {
      timeline.fromTo(
        header,
        {
          autoAlpha: 0,
          y: -10,
          willChange: 'transform,opacity',
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: Math.max(0.22, microDuration + 0.06),
          clearProps: 'willChange',
          force3D: true,
        },
      );
    }

    if (floatingCta) {
      timeline.fromTo(
        floatingCta,
        {
          autoAlpha: 0,
          y: 18,
          scale: 0.96,
          willChange: 'transform,opacity',
        },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: Math.max(0.22, microDuration + 0.08),
          clearProps: 'willChange',
          force3D: true,
        },
        header ? '-=0.12' : 0,
      );
    }

    if (mobileBar) {
      timeline.fromTo(
        mobileBar,
        {
          autoAlpha: 0,
          y: 14,
          willChange: 'transform,opacity',
        },
        {
          autoAlpha: 1,
          y: 0,
          duration: Math.max(0.2, microDuration + 0.06),
          clearProps: 'willChange',
          force3D: true,
        },
        0,
      );
    }

    return () => {
      timeline.kill();
    };
  }, [microDuration, motionEnabled]);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) {
      return;
    }

    const sections = Array.from(main.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement,
    );

    if (sections.length === 0) {
      return;
    }

    if (!motionEnabled) {
      gsap.set(sections, {
        autoAlpha: 1,
        y: 0,
        clearProps: 'transform,opacity,willChange',
      });
      return;
    }

    const animation = gsap.fromTo(
      sections.slice(0, 14),
      {
        autoAlpha: 0,
        y: revealDistance,
        willChange: 'transform,opacity',
      },
      {
        autoAlpha: 1,
        y: 0,
        duration: sectionDuration,
        ease,
        stagger: Math.min(0.05, Math.max(0.016, sectionStagger)),
        clearProps: 'willChange',
        overwrite: 'auto',
        force3D: true,
      },
    );

    return () => {
      animation.kill();
    };
  }, [ease, location.pathname, motionEnabled, revealDistance, sectionDuration, sectionStagger]);

  useEffect(() => {
    if (!isMenuOpen || !mobileMenuRef.current) {
      return;
    }

    const menu = mobileMenuRef.current;

    if (!motionEnabled) {
      gsap.set(menu, {
        autoAlpha: 1,
        y: 0,
        clearProps: 'transform,opacity,willChange',
      });
      return;
    }

    const animation = gsap.fromTo(
      menu,
      {
        autoAlpha: 0,
        y: -8,
        willChange: 'transform,opacity',
      },
      {
        autoAlpha: 1,
        y: 0,
        duration: microDuration,
        ease: 'power2.out',
        clearProps: 'willChange',
        overwrite: 'auto',
        force3D: true,
      },
    );

    return () => {
      animation.kill();
    };
  }, [isMenuOpen, microDuration, motionEnabled]);

  return (
    <div className="public-theme min-h-screen text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="public-orb absolute -left-24 top-4 h-72 w-72 rounded-full bg-amber-200/45 blur-3xl" />
        <div className="public-orb absolute -right-28 top-12 h-80 w-80 rounded-full bg-sky-200/35 blur-3xl" />
        <div className="public-orb absolute bottom-[-12rem] left-[22%] h-96 w-96 rounded-full bg-orange-200/35 blur-3xl" />
      </div>

      <header ref={headerRef} className="fixed inset-x-0 top-0 z-50">
        <div className="hidden border-b border-amber-900/10 bg-white/55 backdrop-blur md:block">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-600 sm:px-6 lg:px-8">
            <p>Consultoria premium em saude suplementar no RJ</p>
            <div className="flex items-center gap-5">
              <a href="tel:+5521979302389" className="hover:text-slate-900">
                (21) 97930-2389
              </a>
              <a href="mailto:contato@kifersaude.com.br" className="hover:text-slate-900">
                contato@kifersaude.com.br
              </a>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mt-3 flex items-center justify-between gap-3 rounded-[1.35rem] border border-white/80 bg-white/78 px-4 py-3 shadow-[0_18px_45px_-32px_rgba(18,28,42,0.75)] backdrop-blur-xl">
            <NavLink to="/" className="flex items-center gap-3" onClick={() => setIsMenuOpen(false)}>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-700 via-orange-600 to-amber-500 shadow-lg shadow-amber-900/25">
                <Heart className="h-6 w-6 text-white" />
              </span>
              <span>
                <span className="public-display block text-[1.5rem] font-semibold leading-none text-slate-900">Kifer Saude</span>
                <span className="block text-[11px] font-bold uppercase tracking-[0.22em] text-amber-800">Concierge de planos</span>
              </span>
            </NavLink>

            <nav className="hidden xl:flex xl:items-center xl:gap-1">
              {navigationItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => navLinkClassName(isActive)}>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="hidden items-center gap-2 md:flex">
              <a
                href="tel:+5521979302389"
                className="inline-flex items-center gap-2 rounded-full border border-amber-900/20 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-amber-700/35 hover:text-slate-900"
              >
                <Phone className="h-4 w-4 text-amber-700" />
                (21) 97930-2389
              </a>
              <NavLink
                to="/cotacao"
                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-700 to-orange-600 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-amber-900/20 transition hover:from-amber-800 hover:to-orange-700"
              >
                Falar com especialista
                <ArrowUpRight className="h-4 w-4" />
              </NavLink>
            </div>

            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className="inline-flex rounded-xl border border-amber-900/20 bg-white p-2 text-slate-700 md:hidden"
              aria-label="Abrir menu"
            >
              {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>

          {isMenuOpen && (
            <div ref={mobileMenuRef} className="mt-2 rounded-2xl border border-amber-900/20 bg-white/95 p-4 shadow-2xl backdrop-blur md:hidden">
              <nav className="flex flex-col gap-1">
                {navigationItems.map((item) => (
                  <NavLink
                    key={`mobile-${item.to}`}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) => navLinkClassName(isActive)}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <NavLink
                to="/cotacao"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-700 to-orange-600 px-5 py-3 text-sm font-bold text-white"
                onClick={() => setIsMenuOpen(false)}
              >
                Solicitar consultoria
                <ArrowUpRight className="h-4 w-4" />
              </NavLink>
            </div>
          )}
        </div>
      </header>

      <main ref={mainRef} className="pt-32 md:pt-36">{children}</main>

      <footer className="relative mt-20 overflow-hidden border-t border-slate-900/10 bg-slate-950 text-slate-200">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(177,125,63,0.28),transparent_36%),radial-gradient(circle_at_90%_8%,rgba(73,117,165,0.22),transparent_34%)]" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.2fr_0.8fr_0.8fr_1fr] lg:px-8">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-700 to-orange-600 shadow-lg shadow-black/30">
                <Heart className="h-5 w-5 text-white" />
              </span>
              <span className="public-display text-[1.65rem] font-semibold text-white">Kifer Saude</span>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-slate-300">
              Consultoria especializada para quem busca uma decisao segura em planos de saude. Traduzimos regras,
              comparamos cenarios reais e acompanhamos sua jornada ate o pos-venda.
            </p>
            <Link
              to="/cotacao"
              className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-500/45 bg-amber-500/15 px-4 py-2 text-sm font-bold text-amber-200 transition hover:bg-amber-500/25"
            >
              Iniciar analise personalizada
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-amber-200">Atendimento</h3>
            <div className="space-y-3 text-sm text-slate-300">
              <a href="tel:+5521979302389" className="flex items-center gap-2 hover:text-white">
                <Phone className="h-4 w-4 text-amber-300" />
                (21) 97930-2389
              </a>
              <a href="mailto:contato@kifersaude.com.br" className="flex items-center gap-2 hover:text-white">
                <Mail className="h-4 w-4 text-amber-300" />
                contato@kifersaude.com.br
              </a>
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-amber-300" />
                Rio de Janeiro e Grande Rio
              </span>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-amber-200">Links uteis</h3>
            <ul className="space-y-3 text-sm text-slate-300">
              {usefulLinks.map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="hover:text-white">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-amber-200">Empresa</h3>
            <p className="text-sm leading-relaxed text-slate-300">
              CNPJ: 46.423.078/0001-10. Corretora especializada em saude suplementar com foco em familia, MEI e
              pequenas empresas.
            </p>
            <a
              href="https://wa.me/5521979302389"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-500/45 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
            >
              <MessageCircle className="h-4 w-4" />
              Conversar no WhatsApp
            </a>
          </div>
        </div>

        <div className="relative border-t border-white/10 px-4 py-5 text-center text-xs text-slate-400">
          <p>(c) 2026 Kifer Saude. Todos os direitos reservados.</p>
        </div>
      </footer>

      <a
        ref={floatingWhatsAppRef}
        href="https://wa.me/5521979302389"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xl shadow-emerald-700/30 transition-transform hover:scale-105"
        aria-label="Abrir conversa no WhatsApp"
      >
        <MessageCircle className="h-7 w-7" />
      </a>

      <div ref={mobileWhatsAppBarRef} className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-300/60 bg-white/95 p-3 backdrop-blur md:hidden">
        <a
          href="https://wa.me/5521979302389"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-emerald-700/30"
        >
          Falar com especialista agora
        </a>
      </div>
    </div>
  );
}
