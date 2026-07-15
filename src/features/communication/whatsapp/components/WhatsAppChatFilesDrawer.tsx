import { useEffect, useState } from 'react';
import { Download, FileAudio, FileText, Image, Loader2, Play, Video } from 'lucide-react';

import { Button, DialogHeader, DialogTitle, Drawer, DrawerBody, DrawerHeader, EmptyState, Tabs } from '../../../../design-system';
import { commWhatsAppService, type CommWhatsAppMediaType } from '../../../../lib/commWhatsAppService';
import type { CommWhatsAppMessage } from '../../../../lib/supabase';

type ChatFilesDrawerProps = {
  chatId: string | null;
  chatDisplayName: string;
  isOpen: boolean;
  onClose: () => void;
  onOpenMedia: (message: CommWhatsAppMessage) => void;
};

const mediaTabs: Array<{ id: CommWhatsAppMediaType; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'image', label: 'Fotos' },
  { id: 'video', label: 'Vídeos' },
  { id: 'document', label: 'Documentos' },
  { id: 'audio', label: 'Áudios' },
];

const formatSize = (value?: number | null) => {
  if (!value) return null;
  return new Intl.NumberFormat('pt-BR', { style: 'unit', unit: 'byte', unitDisplay: 'narrow', notation: 'compact' }).format(value);
};

function FileThumbnail({ message, onOpen }: { message: CommWhatsAppMessage; onOpen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (message.message_type !== 'image' && message.message_type !== 'video') return;
    void commWhatsAppService.resolveMediaObjectUrl({ mediaId: message.media_id, mediaUrl: message.media_url })
      .then((resolved) => {
        if (active) setUrl(resolved);
      })
      .catch(() => {
        if (active) setUrl(null);
      });
    return () => { active = false; };
  }, [message.media_id, message.media_url, message.message_type]);

  const Icon = message.message_type === 'video' ? Video : Image;
  return (
    <button type="button" onClick={onOpen} className="group relative aspect-square overflow-hidden rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] text-left">
      {url && message.message_type === 'image' ? <img src={url} alt={message.media_caption || message.media_file_name || 'Imagem da conversa'} className="h-full w-full object-cover" /> : url && message.message_type === 'video' ? <video src={url} className="h-full w-full object-cover" muted /> : <span className="flex h-full items-center justify-center text-[var(--text-muted)]"><Icon className="h-6 w-6" /></span>}
      {message.message_type === 'video' && <span className="absolute bottom-2 left-2 inline-flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] bg-[color:var(--overlay)] text-[var(--text-on-brand)]"><Play className="h-3.5 w-3.5 fill-current" /></span>}
    </button>
  );
}

export default function WhatsAppChatFilesDrawer({ chatId, chatDisplayName, isOpen, onClose, onOpenMedia }: ChatFilesDrawerProps) {
  const [mediaType, setMediaType] = useState<CommWhatsAppMediaType>('all');
  const [messages, setMessages] = useState<CommWhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (append = false) => {
    if (!chatId) return;
    const setter = append ? setLoadingMore : setLoading;
    setter(true);
    setError(null);
    try {
      const last = append ? messages[messages.length - 1] : null;
      const page = await commWhatsAppService.listChatMediaPage(chatId, {
        mediaType,
        limit: 40,
        before: last ? { messageAt: last.message_at, id: last.id } : null,
      });
      setMessages((current) => append ? [...current, ...page.messages] : page.messages);
      setHasMore(page.hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os arquivos.');
    } finally {
      setter(false);
    }
  };

  useEffect(() => {
    if (isOpen && chatId) void load(false);
  // The selected type and chat intentionally reset the gallery page.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, isOpen, mediaType]);

  const visuals = messages.filter((message) => message.message_type === 'image' || message.message_type === 'video');
  const files = messages.filter((message) => message.message_type !== 'image' && message.message_type !== 'video');

  return (
    <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()} side="right" className="w-full max-w-[440px]">
      <DrawerHeader>
        <DialogHeader onClose={onClose}>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-muted)]">Arquivos da conversa</p>
          <DialogTitle>{chatDisplayName}</DialogTitle>
        </DialogHeader>
      </DrawerHeader>
      <DrawerBody className="space-y-4 overflow-y-auto">
        <Tabs items={mediaTabs} value={mediaType} onChange={setMediaType} variant="underline" listClassName="flex-nowrap overflow-x-auto" />
        {loading ? <div className="flex min-h-40 items-center justify-center text-sm text-[var(--text-muted)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando arquivos...</div> : error ? <EmptyState title="Arquivos indisponíveis" description={error} action={<Button variant="secondary" size="sm" onClick={() => void load(false)}>Tentar novamente</Button>} /> : messages.length === 0 ? <EmptyState icon={<FileText className="h-7 w-7" />} title="Nenhum arquivo encontrado" description="Esta conversa ainda não possui arquivos neste filtro." /> : <>
          {visuals.length > 0 && <div className="grid grid-cols-3 gap-2">{visuals.map((message) => <FileThumbnail key={message.id} message={message} onOpen={() => onOpenMedia(message)} />)}</div>}
          {files.length > 0 && <div className="space-y-2">{files.map((message) => {
            const Icon = message.message_type === 'audio' || message.message_type === 'voice' ? FileAudio : FileText;
            return <div key={message.id} className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface-muted)] p-3"><span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--brand-primary)]"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[var(--text-primary)]">{message.media_file_name || (message.message_type === 'voice' ? 'Mensagem de voz' : 'Arquivo sem nome')}</p><p className="mt-1 text-xs text-[var(--text-muted)]">{new Date(message.message_at).toLocaleDateString('pt-BR')} {formatSize(message.media_size_bytes) ? `· ${formatSize(message.media_size_bytes)}` : ''}</p></div><Button size="icon" variant="secondary" title="Abrir ou baixar" aria-label="Abrir ou baixar arquivo" onClick={() => onOpenMedia(message)}><Download className="h-4 w-4" /></Button></div>;
          })}</div>}
          {hasMore && <Button variant="secondary" size="sm" fullWidth loading={loadingMore} onClick={() => void load(true)}>{!loadingMore && 'Carregar mais'}</Button>}
        </>}
      </DrawerBody>
    </Drawer>
  );
}
