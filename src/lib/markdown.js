// Minimal, self-contained Markdown to HTML renderer.
//
// Security model: the ENTIRE input is HTML-escaped first, so any raw markup a
// user pastes (script, onerror, iframe) becomes inert text. We then emit only a
// fixed whitelist of tags built from the escaped text, and sanitize the
// href/src of every link and image. Nothing the user writes reaches the DOM as
// live HTML, so the output is safe to inject with dangerouslySetInnerHTML.
//
// Supported: ATX headings, bold/italic/strikethrough, inline + fenced code,
// links, images, blockquotes, ordered/unordered/task lists (one level),
// horizontal rules, GFM tables, and paragraphs.

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Only allow safe URL schemes; block javascript:, data: (except images), etc.
function safeUrl(url, allowData = false) {
  const u = url.trim();
  if (/^(https?:|mailto:|tel:|#|\/|\.{0,2}\/)/i.test(u)) return u;
  if (allowData && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(u)) return u;
  if (/^[a-z0-9._~%-]+$/i.test(u)) return u; // bare relative path / anchor-ish
  return '#';
}

// Inline spans. Input is ALREADY html-escaped.
function inline(text) {
  let s = text;

  // Fully-formed tags we generate are stashed behind NUL sentinels so the
  // emphasis pass below cannot chew on their attributes (the _ in _blank, say).
  const stash = [];
  const hold = (html) => { stash.push(html); return `\x00${stash.length - 1}\x00`; };

  // inline code (contents must survive emphasis)
  s = s.replace(/`([^`]+)`/g, (_, code) => hold(`<code>${code}</code>`));

  // images, before links
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, alt, src, title) =>
    hold(`<img src="${safeUrl(src, true)}" alt="${alt}"${title ? ` title="${title}"` : ''} />`));

  // links
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, (_, label, href, title) =>
    hold(`<a href="${safeUrl(href)}" target="_blank" rel="noopener noreferrer"${title ? ` title="${title}"` : ''}>${label}</a>`));

  // bold, italic, strikethrough
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  s = s.replace(/(^|[^_])_([^_]+)_(?!_)/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  // restore stashed tags
  s = s.replace(/\x00(\d+)\x00/g, (_, i) => stash[+i]);
  return s;
}

function renderTable(rows) {
  const cells = (line) => line.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  const head = cells(rows[0]);
  const aligns = cells(rows[1]).map(c => {
    const l = c.startsWith(':'), r = c.endsWith(':');
    return l && r ? 'center' : r ? 'right' : l ? 'left' : '';
  });
  const body = rows.slice(2);
  const th = head.map((c, i) => `<th${aligns[i] ? ` style="text-align:${aligns[i]}"` : ''}>${inline(c)}</th>`).join('');
  const trs = body.map(r => {
    const tds = cells(r).map((c, i) => `<td${aligns[i] ? ` style="text-align:${aligns[i]}"` : ''}>${inline(c)}</td>`).join('');
    return `<tr>${tds}</tr>`;
  }).join('');
  return `<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>`;
}

export function markdownToHtml(src) {
  const text = escapeHtml(src.replace(/\r\n?/g, '\n'));
  const lines = text.split('\n');
  const out = [];
  let i = 0;

  const isTableSep = (l) => /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(l);

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    const fence = line.match(/^\s*(`{3,}|~{3,})\s*([\w-]*)\s*$/);
    if (fence) {
      const marker = fence[1][0];
      const lang = fence[2];
      const buf = [];
      i++;
      while (i < lines.length && !new RegExp(`^\\s*${marker}{3,}\\s*$`).test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // closing fence
      out.push(`<pre class="md-code"${lang ? ` data-lang="${lang}"` : ''}><code>${buf.join('\n')}</code></pre>`);
      continue;
    }

    // blank line
    if (/^\s*$/.test(line)) { i++; continue; }

    // heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { const lvl = h[1].length; out.push(`<h${lvl}>${inline(h[2].trim())}</h${lvl}>`); i++; continue; }

    // horizontal rule
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push('<hr />'); i++; continue; }

    // blockquote (consecutive > lines)
    if (/^\s*>/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
      out.push(`<blockquote>${markdownToHtml(buf.join('\n'))}</blockquote>`);
      continue;
    }

    // table: a header row followed by a separator row
    if (line.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const buf = [lines[i], lines[i + 1]];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && !/^\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      out.push(renderTable(buf));
      continue;
    }

    // lists (ordered / unordered / task), one level
    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items = [];
      while (i < lines.length && /^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
        const item = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, '');
        const task = item.match(/^\[([ xX])\]\s+(.*)$/);
        if (task) {
          const checked = task[1].toLowerCase() === 'x' ? ' checked' : '';
          items.push(`<li class="md-task"><input type="checkbox" disabled${checked} /> ${inline(task[2])}</li>`);
        } else {
          items.push(`<li>${inline(item)}</li>`);
        }
        i++;
      }
      out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`);
      continue;
    }

    // paragraph (gather until blank or block start)
    const buf = [line];
    i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) &&
      !/^(#{1,6})\s/.test(lines[i]) && !/^\s*>/.test(lines[i]) &&
      !/^\s*(`{3,}|~{3,})/.test(lines[i]) && !/^\s*([-*+]|\d+\.)\s+/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${inline(buf.join('\n')).replace(/\n/g, '<br />')}</p>`);
  }

  return out.join('\n');
}
