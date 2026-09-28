import { useEffect, useRef } from 'react';

export const useInboxViewportLayout = ({
  selectedChatId,
  composerFocused,
}: {
  selectedChatId: string | null;
  composerFocused: boolean;
}) => {
  const viewportBaselineRef = useRef({ height: 0, width: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const root = document.documentElement;
    const syncViewportHeight = () => {
      const viewportHeight = Math.round(window.visualViewport?.height ?? window.innerHeight);
      const viewportWidth = Math.round(window.visualViewport?.width ?? window.innerWidth);
      const baseline = viewportBaselineRef.current;

      if (!baseline.width || Math.abs(baseline.width - viewportWidth) > 80) {
        viewportBaselineRef.current = { height: viewportHeight, width: viewportWidth };
      } else if (viewportHeight > baseline.height) {
        viewportBaselineRef.current = { ...baseline, height: viewportHeight };
      }

      const keyboardOpen = Boolean(
        selectedChatId
        && composerFocused
        && viewportBaselineRef.current.height - viewportHeight > 120,
      );
      root.style.setProperty('--comm-inbox-viewport-height', `${viewportHeight}px`);
      root.classList.toggle('comm-inbox-keyboard-open', keyboardOpen);
    };

    syncViewportHeight();
    window.visualViewport?.addEventListener('resize', syncViewportHeight);
    window.addEventListener('resize', syncViewportHeight);

    return () => {
      window.visualViewport?.removeEventListener('resize', syncViewportHeight);
      window.removeEventListener('resize', syncViewportHeight);
      root.style.removeProperty('--comm-inbox-viewport-height');
      root.classList.remove('comm-inbox-keyboard-open');
    };
  }, [composerFocused, selectedChatId]);
};
