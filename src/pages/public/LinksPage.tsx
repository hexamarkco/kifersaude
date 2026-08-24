import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

import PublicBrandMark from '../../components/public/PublicBrandMark';
import PublicSeo from '../../components/public/PublicSeo';
import { getPanelButtonClass, LoadingState } from '../../design-system';
import { getLinkIcon } from '../../lib/linkIcons';
import { linksService } from '../../lib/linksService';
import type { PublicLinkItem, PublicLinkPageSettings } from '../../lib/supabase';

export default function LinksPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PublicLinkPageSettings | null>(null);
  const [items, setItems] = useState<PublicLinkItem[]>([]);

  useEffect(() => {
    let mounted = true;

    void linksService.getPublicLinkPage().then((result) => {
      if (!mounted) return;
      setSettings(result.settings);
      setItems(result.items);
      setLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const handleLinkClick = (link: PublicLinkItem) => {
    void linksService.recordLinkClick(link.id);
  };

  const pageTitle = settings?.title || 'Kifer Saúde';

  return (
    <div className="painel-theme kifer-ds theme-dark flex min-h-dvh w-full justify-center overflow-y-auto [background:var(--surface-hero-bg)] px-4 py-10 sm:py-16">
      <PublicSeo
        title={`${pageTitle} — Links`}
        description={settings?.bio || 'Todos os canais e redes sociais em um só lugar.'}
        canonicalPath="/links"
      />

      <div className="w-full max-w-sm sm:max-w-md">
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <LoadingState compact label="Carregando..." />
          </div>
        ) : !settings ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-full [background:var(--brand-primary-gradient)] shadow-[var(--shadow-button)]">
              <PublicBrandMark className="h-8 w-auto text-[color:var(--text-on-brand)]" />
            </div>
            <p className="text-sm text-[color:var(--text-secondary)]">Esta página ainda não está disponível.</p>
          </div>
        ) : (
          <>
            <div className="mb-8 flex flex-col items-center gap-3 text-center">
              {settings.avatar_url ? (
                <img
                  src={settings.avatar_url}
                  alt={pageTitle}
                  className="h-20 w-20 rounded-full border border-[color:var(--border-default)] object-cover shadow-[var(--shadow-button)]"
                />
              ) : (
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full [background:var(--brand-primary-gradient)] shadow-[var(--shadow-button)]">
                  <PublicBrandMark className="h-9 w-auto text-[color:var(--text-on-brand)]" />
                </div>
              )}

              <h1 className="font-[var(--font-display)] text-2xl font-bold text-[color:var(--text-primary)]">
                {pageTitle}
              </h1>

              {settings.bio && (
                <p className="max-w-sm text-sm text-[color:var(--text-secondary)]">{settings.bio}</p>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {items.length === 0 ? (
                <p className="text-center text-sm text-[color:var(--text-secondary)]">
                  Nenhum link disponível no momento.
                </p>
              ) : (
                items.map((link) => {
                  const Icon = getLinkIcon(link.icon);
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleLinkClick(link)}
                      className={getPanelButtonClass({
                        variant: 'secondary',
                        size: 'lg',
                        fullWidth: true,
                        className: 'justify-between',
                      })}
                    >
                      <span className="flex items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{link.title}</span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0" />
                    </a>
                  );
                })
              )}
            </div>

            <a
              href="/"
              className="mt-8 flex items-center justify-center gap-2 text-xs font-medium text-[color:var(--text-muted)] transition hover:text-[color:var(--brand-primary)]"
            >
              <PublicBrandMark className="h-4 w-auto" />
              Kifer Saúde
            </a>
          </>
        )}
      </div>
    </div>
  );
}
