import { useEffect } from 'react';

/** Pura e testável sem precisar montar um componente React. */
export const isClickOutsideAll = (
  target: Node | null,
  containedElements: Array<HTMLElement | null | undefined>,
): boolean => {
  if (!target) {
    return false;
  }

  return !containedElements.some((element) => element?.contains(target));
};

/**
 * Fecha um popover/menu ao clicar fora dele. `getContainedElements` é chamado
 * dentro do handler (não memoizado), então sempre lê os refs/estado mais
 * recentes via closure — passe os valores que devem reabrir o listener em
 * `watch` (ex.: o id da mensagem cujo menu está aberto), do mesmo jeito que o
 * array de dependências de um `useEffect` normal.
 */
export const useClickOutside = (
  active: boolean,
  getContainedElements: () => Array<HTMLElement | null | undefined>,
  onOutsideClick: () => void,
  watch: unknown[] = [],
) => {
  useEffect(() => {
    if (!active) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (isClickOutsideAll(target, getContainedElements())) {
        onOutsideClick();
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...watch]);
};
