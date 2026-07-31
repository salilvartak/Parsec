import { useEffect, useState } from 'react';

// Single source of truth for the layout breakpoints. Panes that sit side by side
// on a desktop stack vertically below `MOBILE`, and the phone layout also swaps
// the mode switcher out of the top bar into its own scrollable row.
export const MOBILE = 760;
export const NARROW = 1024;

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.(query).matches === true,
  );
  useEffect(() => {
    const mq = window.matchMedia?.(query);
    if (!mq) return;
    setMatches(mq.matches);
    const onChange = (e) => setMatches(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** True on phone-sized viewports — the layout switches from columns to rows. */
export function useIsMobile() {
  return useMediaQuery(`(max-width: ${MOBILE}px)`);
}

/** True on tablets/small laptops — keeps columns but trims chrome. */
export function useIsNarrow() {
  return useMediaQuery(`(max-width: ${NARROW}px)`);
}

/** Coarse pointer (finger) — used to grow hit targets and drop hover-only UI. */
export function useIsTouch() {
  return useMediaQuery('(hover: none) and (pointer: coarse)');
}
