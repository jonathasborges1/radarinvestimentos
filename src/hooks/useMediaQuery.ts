import { useState, useEffect } from 'react';

/**
 * Custom hook that detects whether a CSS media query matches.
 * Uses the `window.matchMedia` API and listens for changes.
 *
 * @param query - CSS media query string (e.g., '(max-width: 767px)')
 * @returns boolean indicating if the media query currently matches
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(query);
    setMatches(mediaQueryList.matches);

    const handler = (event: MediaQueryListEvent) => {
      setMatches(event.matches);
    };

    mediaQueryList.addEventListener('change', handler);
    return () => {
      mediaQueryList.removeEventListener('change', handler);
    };
  }, [query]);

  return matches;
}
