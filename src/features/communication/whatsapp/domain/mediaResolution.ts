export type MediaResolutionFailure = {
  message: string;
  retryable: boolean;
};

export function describeMediaResolutionFailure(error: unknown): MediaResolutionFailure {
  const originalMessage = error instanceof Error
    ? error.message
    : 'Não foi possível carregar a mídia.';
  const normalizedMessage = originalMessage.toLocaleLowerCase('pt-BR');

  if (normalizedMessage.includes('specified media not found') || normalizedMessage.includes('media not found')) {
    return {
      message: 'Arquivo expirado. Peça ao contato para enviá-lo novamente.',
      retryable: false,
    };
  }

  return { message: originalMessage, retryable: true };
}
