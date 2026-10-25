import { Text, TextLink } from '../../../design-system';
export default function PrivacyNotice() {
  return (
    <Text className="mt-4 text-center text-sm leading-relaxed text-[color:var(--text-secondary)]">
      Ao enviar seus dados, você declara estar ciente de nossa{' '}
      <TextLink href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
        Política de Privacidade (abre em nova aba)
      </TextLink>{' '}
      e solicita contato sobre sua cotação.
    </Text>
  );
}
