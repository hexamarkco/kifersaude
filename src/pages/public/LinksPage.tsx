import { useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck } from 'lucide-react';

import PublicBrandMark from '../../components/public/PublicBrandMark';
import PublicSeo from '../../components/public/PublicSeo';
import {
  Avatar,
  AvatarBadge,
  KIFER_THEME_COLORS,
  LinkButton,
  LoadingState,
  PublicEmptyState,
  PublicShell,
  TextLink,
} from '../../design-system';
import { getLinkIcon } from '../../lib/linkIcons';
import { linksService } from '../../lib/linksService';
import type { PublicLinkItem, PublicLinkPageSettings } from '../../features/public-content';

const LINK_REVEAL_BASE_DELAY_MS = 200;
const LINK_REVEAL_STEP_MS = 70;
const DARK_CANVAS_COLOR = KIFER_THEME_COLORS.darkCanvas;
const DEFAULT_THEME_COLOR = KIFER_THEME_COLORS.lightCanvas;

export default function LinksPage() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PublicLinkPageSettings | null>(null);
  const [items, setItems] = useState<PublicLinkItem[]>([]);

  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]');
    const previousColor = meta?.getAttribute('content') ?? DEFAULT_THEME_COLOR;
    meta?.setAttribute('content', DARK_CANVAS_COLOR);

    return () => {
      meta?.setAttribute('content', previousColor);
    };
  }, []);

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
    <PublicShell
      theme="dark"
      width="narrow"
      className="flex min-h-dvh w-full justify-center overflow-y-auto px-4 py-10 sm:py-16"
    >
      <PublicSeo
        title={`${pageTitle} — Links`}
        description={settings?.bio || 'Todos os canais e redes sociais em um só lugar.'}
        canonicalPath="/links"
        indexable={false}
      />

      <main className="w-full max-w-sm sm:max-w-md">
        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <LoadingState compact label="Carregando..." />
          </div>
        ) : !settings ? (
          <PublicEmptyState
            icon={<PublicBrandMark className="h-8 w-auto" />}
            title="Esta página ainda não está disponível."
          />
        ) : (
          <>
            <div className="kds-public-reveal mb-8 flex flex-col items-center gap-3 text-center">
              <div className="relative">
                <Avatar
                  src={settings.avatar_url}
                  alt={pageTitle}
                  name={pageTitle}
                  size="xl"
                  fallback={<PublicBrandMark className="h-9 w-auto" />}
                  className="border border-[color:var(--border-default)] shadow-[var(--shadow-button)]"
                />

                {settings.is_verified && (
                  <AvatarBadge position="bottom-right" title="Perfil verificado">
                    <BadgeCheck className="h-4 w-4" />
                  </AvatarBadge>
                )}
              </div>

              <div>
                <h1 className="font-[var(--font-display)] text-2xl font-bold text-[color:var(--text-primary)]">
                  {pageTitle}
                </h1>
                {settings.subtitle && (
                  <p className="mt-0.5 text-sm font-medium text-[color:var(--brand-primary)]">{settings.subtitle}</p>
                )}
              </div>

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
                items.map((link, index) => {
                  const Icon = getLinkIcon(link.icon);
                  return (
                    <LinkButton
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleLinkClick(link)}
                      style={{ animationDelay: `${LINK_REVEAL_BASE_DELAY_MS + index * LINK_REVEAL_STEP_MS}ms` }}
                      variant="secondary"
                      size="lg"
                      className="kds-public-reveal w-full justify-between text-left"
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 truncate">{link.title}</span>
                      </span>
                      <ArrowUpRight className="h-4 w-4 shrink-0" />
                    </LinkButton>
                  );
                })
              )}
            </div>

            <TextLink
              href="/"
              style={{ animationDelay: `${LINK_REVEAL_BASE_DELAY_MS + items.length * LINK_REVEAL_STEP_MS}ms` }}
              className="links-reveal mt-8 flex items-center justify-center gap-2 text-xs font-medium text-[color:var(--text-muted)] transition hover:text-[color:var(--brand-primary)]"
            >
              <PublicBrandMark className="h-4 w-auto" />
              Kifer Saúde
            </TextLink>
          </>
        )}
      </main>

    </PublicShell>
  );
}
