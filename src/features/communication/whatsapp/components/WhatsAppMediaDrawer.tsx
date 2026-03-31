import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Clock3,
  Coffee,
  Flame,
  Globe,
  Heart,
  Loader2,
  PartyPopper,
  PawPrint,
  Search,
  Smile,
  Sparkles,
  SunMedium,
  X,
  type LucideIcon,
} from 'lucide-react';

import PanelPopoverShell from '../../../../components/ui/PanelPopoverShell';

type DrawerMode = 'emoji' | 'gif' | 'sticker';

type MediaDrawerPosition = {
  top: number;
  left: number;
  width?: number;
  maxHeight?: number;
};

type TenorMediaItem = {
  id: string;
  title: string;
  previewUrl: string;
  sendUrl: string;
  mimeType: string;
  sendKind: 'image' | 'video';
};

type EmojiItem = {
  emoji: string;
  label: string;
  keywords: string[];
};

type EmojiCategory = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: EmojiItem[];
};

type MediaShortcut = {
  id: string;
  label: string;
  term: string;
  icon: LucideIcon;
};

type WhatsAppMediaDrawerProps = {
  isOpen: boolean;
  position: MediaDrawerPosition | null;
  triggerRef: React.RefObject<HTMLElement | null>;
  canSendMedia: boolean;
  mediaDisabledReason?: string | null;
  sendingMedia: boolean;
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSendMedia: (item: TenorMediaItem) => Promise<void>;
};

const TENOR_API_KEY = 'AIzaSyC-P6_qz3FzCoXGLk6tgitZo4jEJ5mLzD8';
const TENOR_CLIENT_KEY = 'tenor_web';
const RECENT_EMOJIS_STORAGE_KEY = 'comm.whatsapp.media-drawer.recent-emojis.v1';
const MAX_RECENT_EMOJIS = 18;

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'smileys',
    label: 'Smileys e pessoas',
    icon: Smile,
    items: [
      { emoji: '😀', label: 'Sorriso aberto', keywords: ['feliz', 'sorriso', 'smile'] },
      { emoji: '😃', label: 'Sorriso grande', keywords: ['feliz', 'joy'] },
      { emoji: '😄', label: 'Riso alegre', keywords: ['feliz', 'happy'] },
      { emoji: '😁', label: 'Sorriso com dentes', keywords: ['alegre', 'animado'] },
      { emoji: '😆', label: 'Rindo', keywords: ['risada', 'haha'] },
      { emoji: '🥹', label: 'Emocionado', keywords: ['emocao', 'fofo'] },
      { emoji: '😂', label: 'Rindo muito', keywords: ['risada', 'haha', 'kkk'] },
      { emoji: '🤣', label: 'Rolando de rir', keywords: ['risada', 'meme'] },
      { emoji: '🙂', label: 'Sorriso leve', keywords: ['gentil', 'leve'] },
      { emoji: '😉', label: 'Piscando', keywords: ['wink', 'piscadinha'] },
      { emoji: '😊', label: 'Sorriso tímido', keywords: ['fofo', 'carinho'] },
      { emoji: '🥰', label: 'Apaixonado', keywords: ['amor', 'carinho'] },
      { emoji: '😍', label: 'Olhos de coração', keywords: ['amor', 'apaixonado'] },
      { emoji: '😘', label: 'Beijinho', keywords: ['beijo', 'kiss'] },
      { emoji: '😌', label: 'Alívio', keywords: ['calma', 'sereno'] },
      { emoji: '🤔', label: 'Pensando', keywords: ['duvida', 'hmm'] },
      { emoji: '😎', label: 'Óculos escuros', keywords: ['estilo', 'cool'] },
      { emoji: '🥳', label: 'Comemorando', keywords: ['festa', 'parabens'] },
    ],
  },
  {
    id: 'gestures',
    label: 'Gestos',
    icon: Sparkles,
    items: [
      { emoji: '👍', label: 'Joinha', keywords: ['ok', 'boa'] },
      { emoji: '👎', label: 'Deslike', keywords: ['ruim', 'nao'] },
      { emoji: '👏', label: 'Palmas', keywords: ['aplauso', 'parabens'] },
      { emoji: '🙌', label: 'Mãos pra cima', keywords: ['celebrar', 'gloria'] },
      { emoji: '🤝', label: 'Aperto de mão', keywords: ['acordo', 'parceria'] },
      { emoji: '🙏', label: 'Gratidão', keywords: ['obrigado', 'amem'] },
      { emoji: '💪', label: 'Força', keywords: ['forte', 'bora'] },
      { emoji: '👀', label: 'Olhando', keywords: ['ver', 'atento'] },
      { emoji: '👌', label: 'Perfeito', keywords: ['ok', 'perfeito'] },
      { emoji: '🤌', label: 'Caprichado', keywords: ['detalhe', 'top'] },
      { emoji: '✍️', label: 'Anotando', keywords: ['escrever', 'agenda'] },
      { emoji: '🤳', label: 'Selfie', keywords: ['foto', 'camera'] },
    ],
  },
  {
    id: 'hearts',
    label: 'Corações',
    icon: Heart,
    items: [
      { emoji: '❤️', label: 'Coração vermelho', keywords: ['amor', 'heart'] },
      { emoji: '🧡', label: 'Coração laranja', keywords: ['amor', 'carinho'] },
      { emoji: '💛', label: 'Coração amarelo', keywords: ['amizade', 'luz'] },
      { emoji: '💚', label: 'Coração verde', keywords: ['esperanca', 'natureza'] },
      { emoji: '💙', label: 'Coração azul', keywords: ['calma', 'afeto'] },
      { emoji: '💜', label: 'Coração roxo', keywords: ['carinho', 'fofo'] },
      { emoji: '🩷', label: 'Coração rosa', keywords: ['amor', 'romantico'] },
      { emoji: '🤍', label: 'Coração branco', keywords: ['paz', 'pureza'] },
      { emoji: '🤎', label: 'Coração marrom', keywords: ['acolhimento', 'terra'] },
      { emoji: '🖤', label: 'Coração preto', keywords: ['forte', 'misterio'] },
      { emoji: '💞', label: 'Corações girando', keywords: ['casal', 'amor'] },
      { emoji: '💕', label: 'Dois corações', keywords: ['amor', 'cute'] },
      { emoji: '💖', label: 'Brilho no coração', keywords: ['brilho', 'fofo'] },
      { emoji: '💘', label: 'Coração com flecha', keywords: ['cupido', 'amor'] },
    ],
  },
  {
    id: 'celebration',
    label: 'Celebração',
    icon: PartyPopper,
    items: [
      { emoji: '🎉', label: 'Confete', keywords: ['festa', 'parabens'] },
      { emoji: '🎊', label: 'Confete colorido', keywords: ['celebracao', 'festa'] },
      { emoji: '🎂', label: 'Bolo', keywords: ['aniversario', 'parabens'] },
      { emoji: '🍰', label: 'Fatia de bolo', keywords: ['doce', 'festa'] },
      { emoji: '🎁', label: 'Presente', keywords: ['surpresa', 'gift'] },
      { emoji: '✨', label: 'Brilhos', keywords: ['brilho', 'destaque'] },
      { emoji: '🌟', label: 'Estrela brilhante', keywords: ['estrela', 'show'] },
      { emoji: '🥂', label: 'Brinde', keywords: ['celebrar', 'saude'] },
      { emoji: '🍾', label: 'Champanhe', keywords: ['comemorar', 'festa'] },
      { emoji: '🎈', label: 'Balão', keywords: ['festa', 'aniversario'] },
      { emoji: '🪩', label: 'Globo disco', keywords: ['festa', 'dance'] },
      { emoji: '🕯️', label: 'Vela', keywords: ['aniversario', 'esperanca'] },
    ],
  },
  {
    id: 'nature',
    label: 'Natureza e bichos',
    icon: PawPrint,
    items: [
      { emoji: '🌞', label: 'Sol', keywords: ['bom dia', 'sun'] },
      { emoji: '🌻', label: 'Girassol', keywords: ['flor', 'alegria'] },
      { emoji: '🌷', label: 'Tulipa', keywords: ['flor', 'delicado'] },
      { emoji: '🌹', label: 'Rosa', keywords: ['amor', 'romantico'] },
      { emoji: '🍀', label: 'Trevo', keywords: ['sorte', 'luck'] },
      { emoji: '🦋', label: 'Borboleta', keywords: ['leveza', 'natureza'] },
      { emoji: '🐶', label: 'Cachorro', keywords: ['pet', 'dog'] },
      { emoji: '🐱', label: 'Gato', keywords: ['pet', 'cat'] },
      { emoji: '🐻', label: 'Urso', keywords: ['cute', 'fofo'] },
      { emoji: '🐼', label: 'Panda', keywords: ['fofo', 'panda'] },
      { emoji: '🐥', label: 'Pintinho', keywords: ['fofo', 'bird'] },
      { emoji: '🌈', label: 'Arco-íris', keywords: ['cor', 'esperanca'] },
    ],
  },
  {
    id: 'food',
    label: 'Comidas e drinks',
    icon: Coffee,
    items: [
      { emoji: '☕', label: 'Café', keywords: ['bom dia', 'coffee'] },
      { emoji: '🧉', label: 'Chimarrão', keywords: ['mate', 'bebida'] },
      { emoji: '🥐', label: 'Croissant', keywords: ['cafe da manha', 'pao'] },
      { emoji: '🍞', label: 'Pão', keywords: ['cafe da manha', 'breakfast'] },
      { emoji: '🧀', label: 'Queijo', keywords: ['lanche', 'comida'] },
      { emoji: '🍓', label: 'Morango', keywords: ['fruta', 'doce'] },
      { emoji: '🍫', label: 'Chocolate', keywords: ['doce', 'candy'] },
      { emoji: '🍕', label: 'Pizza', keywords: ['jantar', 'food'] },
      { emoji: '🍔', label: 'Hambúrguer', keywords: ['lanche', 'food'] },
      { emoji: '🍿', label: 'Pipoca', keywords: ['cinema', 'snack'] },
      { emoji: '🍷', label: 'Taça de vinho', keywords: ['brinde', 'drink'] },
      { emoji: '🧁', label: 'Cupcake', keywords: ['doce', 'aniversario'] },
    ],
  },
];

const MEDIA_SHORTCUTS: Record<'gif' | 'sticker', MediaShortcut[]> = {
  gif: [
    { id: 'bom-dia', label: 'Bom dia', term: 'bom dia', icon: SunMedium },
    { id: 'amor', label: 'Amor', term: 'amor', icon: Heart },
    { id: 'parabens', label: 'Parabéns', term: 'happy birthday', icon: PartyPopper },
    { id: 'cafe', label: 'Café', term: 'coffee', icon: Coffee },
    { id: 'reacao', label: 'Reação', term: 'reaction', icon: Sparkles },
    { id: 'em-alta', label: 'Em alta', term: 'trending', icon: Flame },
  ],
  sticker: [
    { id: 'coracao', label: 'Coração', term: 'heart', icon: Heart },
    { id: 'bom-dia', label: 'Bom dia', term: 'bom dia', icon: SunMedium },
    { id: 'cute', label: 'Fofo', term: 'cute', icon: Sparkles },
    { id: 'animais', label: 'Animais', term: 'cat', icon: PawPrint },
    { id: 'festa', label: 'Festa', term: 'party', icon: PartyPopper },
    { id: 'mundo', label: 'Meme global', term: 'meme', icon: Globe },
  ],
};

const readStoredRecents = () => {
  if (typeof window === 'undefined') {
    return [] as string[];
  }

  try {
    const raw = window.localStorage.getItem(RECENT_EMOJIS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const saveStoredRecents = (items: string[]) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(RECENT_EMOJIS_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_RECENT_EMOJIS)));
  } catch {
    // Ignore localStorage failures for the picker.
  }
};

const buildEmojiLookup = () => {
  const map = new Map<string, EmojiItem>();
  for (const category of EMOJI_CATEGORIES) {
    for (const item of category.items) {
      map.set(item.emoji, item);
    }
  }
  return map;
};

const EMOJI_LOOKUP = buildEmojiLookup();

const buildTenorSearchUrl = (query: string, mode: 'gif' | 'sticker') => {
  const params = new URLSearchParams({
    q: query,
    key: TENOR_API_KEY,
    client_key: TENOR_CLIENT_KEY,
    limit: '24',
    locale: 'pt_BR',
    country: 'BR',
    media_filter: 'basic',
    contentfilter: 'medium',
  });

  if (mode === 'sticker') {
    params.set('searchfilter', 'sticker');
  }

  return `https://tenor.googleapis.com/v2/search?${params.toString()}`;
};

const mapTenorResult = (raw: Record<string, unknown>, mode: 'gif' | 'sticker'): TenorMediaItem | null => {
  const mediaFormats = raw.media_formats as Record<string, Record<string, unknown>> | undefined;
  if (!mediaFormats) {
    return null;
  }

  if (mode === 'gif') {
    const previewUrl = String(mediaFormats.tinygifpreview?.url ?? mediaFormats.gifpreview?.url ?? '').trim();
    const sendUrl = String(mediaFormats.mp4?.url ?? mediaFormats.loopedmp4?.url ?? '').trim();
    if (!previewUrl || !sendUrl) {
      return null;
    }

    return {
      id: String(raw.id ?? sendUrl),
      title: String(raw.h1_title ?? raw.content_description ?? raw.title ?? 'GIF'),
      previewUrl,
      sendUrl,
      mimeType: 'video/mp4',
      sendKind: 'video',
    };
  }

  const previewUrl = String(
    mediaFormats.tinywebppreview_transparent?.url
    ?? mediaFormats.webppreview_transparent?.url
    ?? mediaFormats.tinygifpreview?.url
    ?? mediaFormats.gifpreview?.url
    ?? '',
  ).trim();
  const sendUrl = String(
    mediaFormats.webp_transparent?.url
    ?? mediaFormats.webp?.url
    ?? mediaFormats.gif_transparent?.url
    ?? mediaFormats.gif?.url
    ?? '',
  ).trim();
  if (!previewUrl || !sendUrl) {
    return null;
  }

  const mimeType = sendUrl.endsWith('.webp') ? 'image/webp' : 'image/gif';

  return {
    id: String(raw.id ?? sendUrl),
    title: String(raw.h1_title ?? raw.content_description ?? raw.title ?? 'Figurinha'),
    previewUrl,
    sendUrl,
    mimeType,
    sendKind: 'image',
  };
};

export default function WhatsAppMediaDrawer({
  isOpen,
  position,
  triggerRef,
  canSendMedia,
  mediaDisabledReason,
  sendingMedia,
  onClose,
  onSelectEmoji,
  onSendMedia,
}: WhatsAppMediaDrawerProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const [mode, setMode] = useState<DrawerMode>('emoji');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeEmojiCategoryId, setActiveEmojiCategoryId] = useState('smileys');
  const [activeShortcutId, setActiveShortcutId] = useState(MEDIA_SHORTCUTS.gif[0].id);
  const [recentEmojis, setRecentEmojis] = useState<string[]>(readStoredRecents);
  const [mediaItems, setMediaItems] = useState<TenorMediaItem[]>([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setMediaError(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      const clickedInsidePopover = popoverRef.current && target && popoverRef.current.contains(target);
      const clickedTrigger = triggerRef.current && target && triggerRef.current.contains(target);

      if (!clickedInsidePopover && !clickedTrigger) {
        onClose();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, onClose, triggerRef]);

  useEffect(() => {
    if (!isOpen || mode === 'emoji') {
      return;
    }

    const shortcuts = MEDIA_SHORTCUTS[mode];
    const activeShortcut = shortcuts.find((item) => item.id === activeShortcutId) ?? shortcuts[0];
    const effectiveQuery = searchQuery.trim() || activeShortcut.term;
    const controller = new AbortController();

    setMediaLoading(true);
    setMediaError(null);

    void fetch(buildTenorSearchUrl(effectiveQuery, mode), {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Nao foi possivel consultar a biblioteca de GIFs e figurinhas.');
        }

        const payload = (await response.json()) as { results?: Array<Record<string, unknown>> };
        const nextItems = Array.isArray(payload.results)
          ? payload.results
              .map((item) => mapTenorResult(item, mode))
              .filter((item): item is TenorMediaItem => item !== null)
          : [];

        setMediaItems(nextItems);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }

        console.error('[WhatsAppMediaDrawer] erro ao carregar mídia', error);
        setMediaError(error instanceof Error ? error.message : 'Nao foi possivel carregar a biblioteca agora.');
        setMediaItems([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setMediaLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeShortcutId, isOpen, mode, searchQuery]);

  const emojiSearchResults = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return null;
    }

    return EMOJI_CATEGORIES.flatMap((category) => category.items).filter((item) => {
      return [item.label, ...item.keywords, item.emoji].some((value) => value.toLowerCase().includes(normalizedQuery));
    });
  }, [searchQuery]);

  const recentEmojiItems = useMemo(
    () => recentEmojis.map((emoji) => EMOJI_LOOKUP.get(emoji)).filter((item): item is EmojiItem => Boolean(item)),
    [recentEmojis],
  );

  const handleSelectEmoji = (emoji: string) => {
    onSelectEmoji(emoji);
    setRecentEmojis((current) => {
      const next = [emoji, ...current.filter((item) => item !== emoji)].slice(0, MAX_RECENT_EMOJIS);
      saveStoredRecents(next);
      return next;
    });
  };

  const handleSendSelectedMedia = async (item: TenorMediaItem) => {
    if (!canSendMedia || sendingMedia) {
      return;
    }

    try {
      await onSendMedia(item);
      onClose();
    } catch {
      // The parent handles toast/error reporting.
    }
  };

  const handleScrollToCategory = (categoryId: string) => {
    setActiveEmojiCategoryId(categoryId);
    sectionRefs.current[categoryId]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };

  const emojiPlaceholder = 'Pesquisar emoji';
  const mediaPlaceholder = mode === 'gif' ? 'Pesquisar GIFs' : 'Pesquisar figurinhas';

  return (
    <PanelPopoverShell
      ref={popoverRef}
      isOpen={isOpen}
      position={position}
      onClose={onClose}
      ariaLabel="Gaveta de emoji, GIF e figurinha"
      className="comm-emoji-picker comm-media-picker w-[min(92vw,31rem)]"
    >
      {mode === 'emoji' ? (
        <div className="comm-emoji-picker-tabs">
          {[
            ...(recentEmojiItems.length > 0 ? [{ id: 'recent', label: 'Recentes', icon: Clock3 }] : []),
            ...EMOJI_CATEGORIES.map((category) => ({ id: category.id, label: category.label, icon: category.icon })),
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeEmojiCategoryId === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                className={`comm-emoji-picker-tab ${isActive ? 'is-active' : ''}`}
                aria-label={tab.label}
                title={tab.label}
                onClick={() => handleScrollToCategory(tab.id)}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="comm-media-picker-shortcuts">
          {MEDIA_SHORTCUTS[mode].map((shortcut) => {
            const Icon = shortcut.icon;
            const isActive = activeShortcutId === shortcut.id;

            return (
              <button
                key={shortcut.id}
                type="button"
                className={`comm-media-picker-shortcut ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveShortcutId(shortcut.id)}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{shortcut.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="px-4 pt-4">
        <div className="comm-emoji-search">
          <Search className="comm-emoji-search-icon h-4 w-4" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={mode === 'emoji' ? emojiPlaceholder : mediaPlaceholder}
          />
          {searchQuery ? (
            <button type="button" className="comm-emoji-search-clear" onClick={() => setSearchQuery('')}>
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="comm-emoji-picker-scroll overflow-y-auto px-4 pb-4 pt-4" style={{ height: 420 }}>
        {mode === 'emoji' ? (
          searchQuery.trim() ? (
            emojiSearchResults && emojiSearchResults.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="comm-emoji-picker-section-title">Resultados</h3>
                  <span className="comm-emoji-picker-section-meta">{emojiSearchResults.length}</span>
                </div>
                <div className="grid grid-cols-6 gap-1.5">
                  {emojiSearchResults.map((item) => (
                    <button
                      key={`${item.emoji}-${item.label}`}
                      type="button"
                      className="comm-emoji-picker-item text-[1.6rem]"
                      title={item.label}
                      onClick={() => handleSelectEmoji(item.emoji)}
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="comm-emoji-picker-empty text-sm text-[rgba(255,248,240,0.58)]">
                Nenhum emoji encontrado para essa busca.
              </div>
            )
          ) : (
            <div className="space-y-5">
              {recentEmojiItems.length > 0 ? (
                <section ref={(element) => { sectionRefs.current.recent = element; }} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="comm-emoji-picker-section-title">Recentes</h3>
                    <span className="comm-emoji-picker-section-meta">{recentEmojiItems.length}</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {recentEmojiItems.map((item) => (
                      <button
                        key={`recent-${item.emoji}`}
                        type="button"
                        className="comm-emoji-picker-item text-[1.6rem]"
                        title={item.label}
                        onClick={() => handleSelectEmoji(item.emoji)}
                      >
                        {item.emoji}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {EMOJI_CATEGORIES.map((category) => (
                <section
                  key={category.id}
                  ref={(element) => {
                    sectionRefs.current[category.id] = element;
                  }}
                  className="space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="comm-emoji-picker-section-title">{category.label}</h3>
                    <span className="comm-emoji-picker-section-meta">{category.items.length}</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {category.items.map((item) => (
                      <button
                        key={`${category.id}-${item.emoji}`}
                        type="button"
                        className="comm-emoji-picker-item text-[1.6rem]"
                        title={item.label}
                        onClick={() => handleSelectEmoji(item.emoji)}
                      >
                        {item.emoji}
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        ) : mediaLoading ? (
          <div className="comm-media-picker-empty-state">
            <Loader2 className="h-6 w-6 animate-spin text-white/70" />
            <h3 className="comm-media-picker-empty-title">Carregando {mode === 'gif' ? 'GIFs' : 'figurinhas'}</h3>
          </div>
        ) : mediaError ? (
          <div className="comm-media-picker-empty-state">
            <h3 className="comm-media-picker-empty-title">Falha ao carregar</h3>
            <p className="comm-media-picker-empty-copy">{mediaError}</p>
          </div>
        ) : mediaItems.length === 0 ? (
          <div className="comm-media-picker-empty-state">
            <h3 className="comm-media-picker-empty-title">Nenhum resultado</h3>
            <p className="comm-media-picker-empty-copy">Tente outra busca ou um atalho acima.</p>
          </div>
        ) : (
          <div className={mode === 'gif' ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-4 gap-3'}>
            {mediaItems.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!canSendMedia || sendingMedia}
                title={item.title}
                onClick={() => void handleSendSelectedMedia(item)}
                className={mode === 'gif' ? 'comm-media-picker-gif-card' : 'comm-media-picker-sticker-card'}
              >
                {mode === 'gif' ? (
                  <>
                    <img src={item.previewUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                    <div className="comm-media-picker-gif-overlay">
                      <span>{item.title}</span>
                    </div>
                  </>
                ) : (
                  <img src={item.previewUrl} alt={item.title} className="h-full w-full object-contain p-2" loading="lazy" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="comm-media-picker-modebar">
          {[
          { id: 'emoji', label: <Smile className="h-4 w-4" /> },
          { id: 'gif', label: <span>GIF</span> },
          { id: 'sticker', label: <span>◌</span> },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            className={`comm-media-picker-modebutton ${mode === item.id ? 'is-active' : ''}`}
            onClick={() => {
              setMode(item.id as DrawerMode);
              setSearchQuery('');
              if (item.id !== 'emoji') {
                setActiveShortcutId(MEDIA_SHORTCUTS[item.id as 'gif' | 'sticker'][0].id);
              }
            }}
            title={item.id === 'emoji' ? 'Emoji' : item.id === 'gif' ? 'GIF' : 'Figurinha'}
          >
            {item.label}
          </button>
        ))}
      </div>

      {!canSendMedia && mode !== 'emoji' ? (
        <div className="border-t border-white/10 px-4 pb-4 text-center text-[11px] font-medium text-white/60">
          {mediaDisabledReason || 'Selecione uma conversa para enviar GIFs e figurinhas.'}
        </div>
      ) : null}
    </PanelPopoverShell>
  );
}
