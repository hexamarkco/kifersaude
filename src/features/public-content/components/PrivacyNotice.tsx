export default function PrivacyNotice() {
  return (
    <p className="mt-4 text-center text-sm leading-relaxed text-[color:var(--text-secondary)]">
      Ao enviar seus dados, você declara estar ciente de nossa{' '}
      <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
        Política de Privacidade (abre em nova aba)
      </a>{' '}
      e solicita contato sobre sua cotação.
    </p>
  );
}
