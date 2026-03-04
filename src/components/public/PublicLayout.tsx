import { ReactNode, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Heart, Mail, MapPin, Menu, MessageCircle, Phone, X } from 'lucide-react';

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
  { label: 'Solicitar cotacao', href: '/cotacao' },
  { label: 'Plano pessoa fisica', href: '/planos/pessoa-fisica' },
  { label: 'Plano familiar', href: '/planos/familia' },
  { label: 'Plano MEI/CNPJ', href: '/planos/mei-cnpj' },
  { label: 'Portabilidade', href: '/portabilidade' },
  { label: 'Operadoras parceiras', href: '/operadoras' },
  { label: 'Perguntas frequentes', href: '/faq' },
  { label: 'Politica de privacidade', href: '/politica-de-privacidade' },
  { label: 'Termos de uso', href: '/termos-de-uso' },
];

const navLinkClassName = (isActive: boolean) =>
  [
    'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
    isActive ? 'bg-orange-100 text-orange-700' : 'text-slate-600 hover:bg-orange-50 hover:text-orange-600',
  ].join(' ');

export default function PublicLayout({ children }: PublicLayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-orange-50/40 text-slate-900">
      <header className="fixed left-0 right-0 top-0 z-50 border-b border-orange-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <NavLink
            to="/"
            className="flex items-center gap-3"
            onClick={() => setIsMenuOpen(false)}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-200">
              <Heart className="h-6 w-6 text-white" />
            </span>
            <span>
              <span className="block text-xl font-extrabold tracking-tight text-slate-900">Kifer Saude</span>
              <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-orange-600">Consultoria em planos</span>
            </span>
          </NavLink>

          <nav className="hidden xl:flex xl:items-center xl:gap-1">
            {navigationItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => navLinkClassName(isActive)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden md:flex md:items-center md:gap-3">
            <a
              href="tel:+5521979302389"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-orange-200 hover:text-orange-600"
            >
              <Phone className="h-4 w-4" />
              (21) 97930-2389
            </a>
            <NavLink
              to="/cotacao"
              className="inline-flex items-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-2 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:from-orange-600 hover:to-amber-600"
            >
              Solicitar cotacao
            </NavLink>
          </div>

          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            className="inline-flex rounded-xl border border-slate-200 p-2 text-slate-700 md:hidden"
            aria-label="Abrir menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {isMenuOpen && (
          <div className="border-t border-orange-100 bg-white px-4 py-4 md:hidden">
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
              className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-orange-200"
              onClick={() => setIsMenuOpen(false)}
            >
              Fazer cotacao agora
            </NavLink>
          </div>
        )}
      </header>

      <main className="pt-24">{children}</main>

      <footer className="border-t border-orange-100 bg-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:px-8">
          <div>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-lg shadow-orange-200">
                <Heart className="h-5 w-5 text-white" />
              </span>
              <span className="text-lg font-extrabold text-slate-900">Kifer Saude</span>
            </div>
            <p className="text-sm leading-relaxed text-slate-600">
              Atendimento consultivo para planos de saude no estado do Rio de Janeiro, com comparativos claros,
              explicacao sem letra miuda e suporte ate o pos-venda.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-slate-900">Atendimento</h3>
            <div className="space-y-3 text-sm text-slate-600">
              <a href="tel:+5521979302389" className="flex items-center gap-2 hover:text-orange-600">
                <Phone className="h-4 w-4 text-orange-500" />
                (21) 97930-2389
              </a>
              <a href="mailto:contato@kifersaude.com.br" className="flex items-center gap-2 hover:text-orange-600">
                <Mail className="h-4 w-4 text-orange-500" />
                contato@kifersaude.com.br
              </a>
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-orange-500" />
                Rio de Janeiro e Grande Rio
              </span>
            </div>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-slate-900">Links uteis</h3>
            <ul className="space-y-3 text-sm text-slate-600">
              {usefulLinks.map((item) => (
                <li key={item.href}>
                  <a href={item.href} className="hover:text-orange-600">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-sm font-black uppercase tracking-[0.18em] text-slate-900">Sobre a empresa</h3>
            <p className="mb-4 text-sm leading-relaxed text-slate-600">
              CNPJ: 46.423.078/0001-10. Corretora especializada em saude suplementar com foco em familia,
              MEI e pequenas empresas.
            </p>
            <a
              href="https://wa.me/5521979302389"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 transition-colors hover:bg-green-100"
            >
              <MessageCircle className="h-4 w-4" />
              Conversar no WhatsApp
            </a>
          </div>
        </div>

        <div className="border-t border-slate-100 px-4 py-5 text-center text-xs text-slate-500">
          <p>© 2026 Kifer Saude. Todos os direitos reservados.</p>
        </div>
      </footer>

      <a
        href="https://wa.me/5521979302389"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-500 text-white shadow-2xl shadow-green-300 transition-transform hover:scale-105"
        aria-label="Abrir conversa no WhatsApp"
      >
        <MessageCircle className="h-7 w-7" />
      </a>

      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white p-3 md:hidden">
        <a
          href="https://wa.me/5521979302389"
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-xl bg-green-500 px-4 py-3 text-center text-sm font-bold text-white shadow-lg shadow-green-200"
        >
          Falar com especialista agora
        </a>
      </div>
    </div>
  );
}
