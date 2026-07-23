// Compute document stats: max depth, total key count, node count, byte size.
const MAX_DEPTH = 1000;

export function computeStats(value, rawText) {
  let maxDepth = 0;
  let keyCount = 0;
  let nodeCount = 0;

  function walk(v, depth) {
    if (depth > MAX_DEPTH) return;
    if (depth > maxDepth) maxDepth = depth;
    nodeCount++;
    if (Array.isArray(v)) {
      for (const item of v) walk(item, depth + 1);
    } else if (v && typeof v === 'object') {
      for (const k of Object.keys(v)) {
        keyCount++;
        walk(v[k], depth + 1);
      }
    }
  }
  if (value !== undefined) walk(value, 0);

  const byteSize = rawText ? new Blob([rawText]).size : 0;
  return { maxDepth, keyCount, nodeCount, byteSize };
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
