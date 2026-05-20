import { useEffect, useMemo, useState } from 'react';

export const useWindowPollingState = () => {
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => (typeof document === 'undefined' ? true : !document.hidden));
  const [isWindowFocused, setIsWindowFocused] = useState(() => (typeof document === 'undefined' ? true : document.hasFocus()));

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      setIsDocumentVisible(!document.hidden);
      if (!document.hidden) {
        setIsWindowFocused(document.hasFocus());
      }
    };

    const handleFocus = () => setIsWindowFocused(true);
    const handleBlur = () => setIsWindowFocused(false);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return useMemo(() => ({
    isDocumentVisible,
    isWindowFocused,
    pollingEnabled: isDocumentVisible && isWindowFocused,
  }), [isDocumentVisible, isWindowFocused]);
};
