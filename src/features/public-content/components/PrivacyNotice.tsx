import { Text, TextLink } from '../../../design-system';
import { cx } from '../../../lib/cx';

type PrivacyNoticeProps = {
  className?: string;
  newTabHint?: 'visible' | 'screen-reader';
};

export default function PrivacyNotice({ className, newTabHint = 'visible' }: PrivacyNoticeProps) {
  return (
    <Text className={cx('mt-4 text-center text-sm leading-relaxed text-[color:var(--text-secondary)]', className)}>
      Ao enviar seus dados, você declara estar ciente de nossa{' '}
      <TextLink href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
        Política de Privacidade<span className={newTabHint === 'screen-reader' ? 'sr-only' : undefined}> (abre em nova aba)</span>
      </TextLink>{' '}
      e solicita contato sobre sua cotação.
    </Text>
  );
}
