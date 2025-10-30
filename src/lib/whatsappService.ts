export const openWhatsAppInBackgroundTab = (telefone: string, nome: string): void => {
  try {
    const cleanPhone = telefone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `Olá ${nome}, tudo bem? Sou *Luiza Kifer*, especialista em planos de saúde aqui da UnitedClass, e vi que você demonstrou interesse em um plano de saúde.`
    );
    const whatsappUrl = `https://wa.me/55${cleanPhone}?text=${message}`;

    const newTab = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

    if (newTab) {
      window.focus();

      setTimeout(() => {
        try {
          if (newTab && !newTab.closed) {
            newTab.close();
          }
        } catch (error) {
          console.warn('Não foi possível fechar a aba automaticamente:', error);
        }
      }, 10000);
    } else {
      console.warn('A aba do WhatsApp foi bloqueada pelo navegador. Verifique as configurações de popup.');
    }
  } catch (error) {
    console.error('Erro ao abrir WhatsApp:', error);
  }
};
