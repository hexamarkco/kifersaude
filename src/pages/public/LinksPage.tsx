import { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';

import PublicBrandMark from '../../components/public/PublicBrandMark';
import PublicSeo from '../../components/public/PublicSeo';
import { LoadingState } from '../../design-system';
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
    <div className="flex min-h-screen flex-col items-center bg-[var(--bg-canvas)] px-4 py-12 text-[var(--text-primary)]">
      <PublicSeo
        title={`${pageTitle} — Links`}
        description={settings?.bio || 'Todos os canais e redes sociais em um só lugar.'}
        canonicalPath="/links"
      />

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <LoadingState label="Carregando..." />
        </div>
      ) : !settings ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <PublicBrandMark className="h-10 w-auto text-[var(--brand-primary)]" />
          <p className="text-sm text-[var(--text-muted)]">Esta página ainda não está disponível.</p>
        </div>
      ) : (
        <div className="flex w-full max-w-md flex-col items-center gap-6">
          <div className="flex flex-col items-center gap-3 text-center">
            {settings.avatar_url ? (
              <img
                src={settings.avatar_url}
                alt={pageTitle}
                className="h-20 w-20 rounded-full border border-[var(--border-subtle)] object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[var(--border-subtle)] bg-[var(--brand-primary-soft)]">
                <PublicBrandMark className="h-9 w-auto text-[var(--brand-primary)]" />
              </div>
            )}

            <h1 className="font-[var(--font-display)] text-xl font-semibold text-[var(--text-primary)]">
              {pageTitle}
            </h1>

            {settings.bio && <p className="max-w-sm text-sm text-[var(--text-secondary)]">{settings.bio}</p>}
          </div>

          <div className="flex w-full flex-col gap-3">
            {items.length === 0 ? (
              <p className="text-center text-sm text-[var(--text-muted)]">Nenhum link disponível no momento.</p>
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
                    className="group flex items-center gap-3 rounded-[var(--kds-radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--brand-primary-border)] hover:shadow-md"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-[var(--brand-primary)]">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="flex-1 text-center text-sm font-medium text-[var(--text-primary)]">
                      {link.title}
                    </span>
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition group-hover:text-[var(--brand-primary)]" />
                  </a>
                );
              })
            )}
          </div>

          <a
            href="/"
            className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--brand-primary)]"
          >
            <PublicBrandMark className="h-4 w-auto" />
            Kifer Saúde
          </a>
        </div>
      )}
    </div>
  );
}
