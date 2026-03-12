import { X } from 'lucide-react';

type ComposerContextBannerProps = {
  title: string;
  body: string;
  onClose?: () => void;
};

export function ComposerContextBanner({ title, body, onClose }: ComposerContextBannerProps) {
  return (
    <div className="comm-banner flex items-center justify-between px-4 py-2">
      <div className="min-w-0 flex-1">
        <div className="comm-accent-text text-xs font-medium">{title}</div>
        <div className="comm-text truncate text-sm">{body}</div>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="comm-icon-button ml-2 p-1"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
