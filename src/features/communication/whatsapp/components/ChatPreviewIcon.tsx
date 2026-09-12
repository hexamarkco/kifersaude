import {
  Calendar,
  FileAudio,
  FileImage,
  FileText,
  Images,
  Info,
  Link2,
  MapPin,
  MessageCircle,
  Sticker,
  UserRound,
  Vote,
} from 'lucide-react';

import type { ChatPreviewIconType } from '../domain/messagePresentation';

const CHAT_PREVIEW_ICON_CONFIG: Record<ChatPreviewIconType, { label: string; Icon: typeof FileImage }> = {
  image: { label: 'foto', Icon: FileImage },
  video: { label: 'vídeo', Icon: Images },
  audio: { label: 'áudio', Icon: FileAudio },
  document: { label: 'documento', Icon: FileText },
  link: { label: 'link', Icon: Link2 },
  location: { label: 'localização', Icon: MapPin },
  sticker: { label: 'figurinha', Icon: Sticker },
  contact: { label: 'contato', Icon: UserRound },
  poll: { label: 'enquete', Icon: Vote },
  list: { label: 'lista', Icon: MessageCircle },
  event: { label: 'evento', Icon: Calendar },
  product: { label: 'produto', Icon: FileImage },
  system: { label: 'sistema', Icon: Info },
  interactive: { label: 'mensagem', Icon: MessageCircle },
};

export default function ChatPreviewIcon({ type }: { type: ChatPreviewIconType }) {
  const { label, Icon } = CHAT_PREVIEW_ICON_CONFIG[type];

  return (
    <span
      aria-label={label}
      className="inline-flex items-center gap-1 align-middle text-[var(--text-muted)]"
      role="img"
      title={label}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      <span>{label}</span>
    </span>
  );
}
