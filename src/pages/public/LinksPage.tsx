import { useEffect, useState } from 'react';
import { ArrowUpRight, BadgeCheck, RefreshCw } from 'lucide-react';

import PublicBrandMark from '../../components/public/PublicBrandMark';
import PublicSeo from '../../components/public/PublicSeo';
import {
  Avatar,
  AvatarBadge,
  Button,
  Heading,
  KIFER_THEME_COLORS,
  LinkButton,
  LoadingState,
  PublicEmptyState,
  PublicShell,
  Text,
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
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
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

    setLoading(true);
    setLoadError(false);
    setSettings(null);
    setItems([]);

    void linksService.getPublicLinkPage()
      .then((result) => {
        if (!mounted) return;
        setSettings(result.settings);
        setItems(result.items);
      })
      .catch((error) => {
        if (!mounted) return;
        console.error('Erro ao carregar página pública de links:', error);
        setLoadError(true);
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [loadAttempt]);

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
        ) : loadError ? (
          <PublicEmptyState
            icon={<PublicBrandMark className="kds-public-brand-mark kds-public-brand-mark-md" />}
            title="Não foi possível carregar esta página."
            description="Verifique sua conexão e tente novamente."
          >
            <Button variant="secondary" size="sm" onClick={() => setLoadAttempt((current) => current + 1)}>
              <RefreshCw className="kds-control-icon" />
              <span>Tentar novamente</span>
            </Button>
          </PublicEmptyState>
        ) : !settings ? (
          <PublicEmptyState
            icon={<PublicBrandMark className="kds-public-brand-mark kds-public-brand-mark-md" />}
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
                  fallback={<PublicBrandMark className="kds-public-brand-mark kds-public-brand-mark-md" />}
                  className="kds-public-profile-avatar"
                />

                {settings.is_verified && (
                  <AvatarBadge position="bottom-right" title="Perfil verificado">
                    <BadgeCheck className="kds-control-icon" />
                  </AvatarBadge>
                )}
              </div>

              <div>
                <Heading level={1} size="lg">
                  {pageTitle}
                </Heading>
                {settings.subtitle && (
                  <Text size="sm" weight="medium" tone="brand" className="mt-0.5">{settings.subtitle}</Text>
                )}
              </div>

              {settings.bio && (
                <Text size="sm" className="max-w-sm">{settings.bio}</Text>
              )}
            </div>

            <div className="flex flex-col gap-3">
              {items.length === 0 ? (
                <Text size="sm" className="text-center">
                  Nenhum link disponível no momento.
                </Text>
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
                        <Icon className="kds-control-icon shrink-0" />
                        <span className="min-w-0 truncate">{link.title}</span>
                      </span>
                      <ArrowUpRight className="kds-control-icon shrink-0" />
                    </LinkButton>
                  );
                })
              )}
            </div>

            <TextLink
              href="/"
              style={{ animationDelay: `${LINK_REVEAL_BASE_DELAY_MS + items.length * LINK_REVEAL_STEP_MS}ms` }}
              tone="muted"
              className="links-reveal kds-public-footer-link"
            >
              <PublicBrandMark className="kds-public-brand-mark kds-public-brand-mark-xs" />
              Kifer Saúde
            </TextLink>
          </>
        )}
      </main>

    </PublicShell>
  );
}
