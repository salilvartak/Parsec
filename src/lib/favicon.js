// Swap the favicon between the light and dark marks. The <link> tags are
// declared in index.html and tagged with data-favicon="<size>"; the pre-mount
// script there already applies the dark set, so this only has to react to later
// theme changes (manual toggle, settings drawer, OS switch).
export function applyFavicon(theme) {
  const dark = theme === 'dark';
  for (const link of document.querySelectorAll('link[data-favicon]')) {
    const size = link.getAttribute('data-favicon');
    const href = dark ? `/favicon-dark-${size}.png` : `/favicon-${size}.png`;
    // Reassigning an identical href makes Chrome re-fetch and flicker.
    if (!link.href.endsWith(href)) link.href = href;
  }
}
