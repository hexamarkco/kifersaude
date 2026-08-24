import {
  Facebook,
  Globe,
  Instagram,
  Link2,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  Youtube,
  type LucideIcon,
} from 'lucide-react';

export const LINK_ICON_OPTIONS: Array<{ value: string; label: string; icon: LucideIcon }> = [
  { value: 'link', label: 'Link', icon: Link2 },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'youtube', label: 'YouTube', icon: Youtube },
  { value: 'tiktok', label: 'TikTok', icon: Music2 },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { value: 'email', label: 'E-mail', icon: Mail },
  { value: 'phone', label: 'Telefone', icon: Phone },
  { value: 'location', label: 'Endereço', icon: MapPin },
  { value: 'website', label: 'Site', icon: Globe },
];

const LINK_ICON_MAP: Record<string, LucideIcon> = LINK_ICON_OPTIONS.reduce(
  (accumulator, option) => {
    accumulator[option.value] = option.icon;
    return accumulator;
  },
  {} as Record<string, LucideIcon>,
);

export const getLinkIcon = (value: string | null | undefined): LucideIcon =>
  (value && LINK_ICON_MAP[value]) || Link2;
