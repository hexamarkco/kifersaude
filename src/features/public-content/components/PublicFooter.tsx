import type { MouseEvent } from 'react';
import { Instagram, MapPin, MessageCircle } from 'lucide-react';
import PublicBrandMark from '../../../components/public/PublicBrandMark';
import { siteConfig } from '../../../config/site';

type Props = { onNavigate?: (event: MouseEvent<HTMLAnchorElement>, section: string) => void };

export default function PublicFooter({ onNavigate }: Props) {
  return (
    <footer className="bg-[var(--text-primary)] px-4 py-14 text-[color:var(--text-inverse)] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--brand-primary)]">
                <PublicBrandMark className="h-6 w-auto text-[color:var(--text-on-brand)]" />
              </div>
              <span className="text-2xl font-bold">Kifer Saúde</span>
            </div>
            <p className="mt-5 max-w-md text-sm leading-relaxed opacity-70">
              Corretora especializada em planos de saúde no Rio de Janeiro, com atendimento humano, comparação consultiva e suporte até o pós-venda.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-[color:var(--accent-gold)]">Links rápidos</h3>
            <div className="mt-5 space-y-3 text-sm opacity-70">
              <a
                href="/#para-quem"
                onClick={onNavigate ? (event) => onNavigate(event, 'para-quem') : undefined}
                className="block transition-colors hover:text-[color:var(--text-inverse)]"
              >
                Para quem é
              </a>
              <a
                href="/#como-funciona"
                onClick={onNavigate ? (event) => onNavigate(event, 'como-funciona') : undefined}
                className="block transition-colors hover:text-[color:var(--text-inverse)]"
              >
                Como funciona
              </a>
              <a
                href="/#faq"
                onClick={onNavigate ? (event) => onNavigate(event, 'faq') : undefined}
                className="block transition-colors hover:text-[color:var(--text-inverse)]"
              >
                FAQ
              </a>
              <a
                href="/#cotacao"
                onClick={onNavigate ? (event) => onNavigate(event, 'cotacao') : undefined}
                className="block transition-colors hover:text-[color:var(--text-inverse)]"
              >
                Cotação gratuita
              </a>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-[color:var(--accent-gold)]">Contato</h3>
            <div className="mt-5 space-y-3 text-sm opacity-70">
              <a href={`${siteConfig.whatsappUrl}?text=${encodeURIComponent('Olá! Quero uma cotação de plano de saúde com a Kifer.')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors hover:text-[color:var(--text-inverse)]">
                <MessageCircle className="h-4 w-4 text-[color:var(--success)]" />
                WhatsApp
              </a>
              <a href={siteConfig.instagramUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 transition-colors hover:text-[color:var(--text-inverse)]">
                <Instagram className="h-4 w-4 text-[color:var(--accent-gold)]" />
                @souluizakifer
              </a>
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[color:var(--accent-gold)]" />
                Rio de Janeiro, RJ
              </span>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-[color:var(--accent-gold)]">Legal</h3>
            <div className="mt-5 space-y-3 text-sm opacity-70">
              <a href="/politica-de-privacidade" className="block underline underline-offset-4">Política de Privacidade</a>
              <p>CNPJ: {siteConfig.cnpj}</p>
              <p>Desenvolvido por Kifer Saúde</p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
