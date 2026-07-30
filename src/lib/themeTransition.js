import { flushSync } from 'react-dom';

// Gradual theme switch using the View Transitions API: the new theme is revealed
// with a circle that expands from the point the user clicked. Falls back to an
// instant switch where the API is missing (Firefox, Safari < 18) or the user
// asked for reduced motion.
//
// `apply` must synchronously trigger the store update; we wrap it in flushSync
// so React commits the new theme to the DOM *inside* the transition callback,
// which is what the API snapshots against.
export function toggleThemeAnimated(apply, origin) {
  const doc = document;
  const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (!doc.startViewTransition || reduced) { apply(); return; }

  const x = origin?.x ?? window.innerWidth / 2;
  const y = origin?.y ?? window.innerHeight / 2;
  // radius to the farthest corner, so the circle covers the whole viewport
  const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));

  const transition = doc.startViewTransition(() => { flushSync(() => apply()); });

  transition.ready.then(() => {
    doc.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
      { duration: 480, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' },
    );
  });
}
