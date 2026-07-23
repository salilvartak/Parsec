import { JSONPath } from 'jsonpath-plus';

// Query the document. Returns { success, values, paths } or { success:false, error }.
// paths are normalized to dot/bracket form matching our tree node paths (root.a.b[0]).
export function queryJsonPath(value, query) {
  if (!query || query.trim() === '') return { success: true, values: [], paths: [] };
  try {
    const results = JSONPath({ path: query, json: value, resultType: 'all' });
    const values = results.map(r => r.value);
    const paths = results.map(r => normalizePointer(r.pointer));
    return { success: true, values, paths };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// jsonpath-plus pointer looks like "/data/order/items/0/sku".
// Convert to "root.data.order.items[0].sku" to match TreeNode paths.
function normalizePointer(pointer) {
  if (!pointer) return 'root';
  const parts = pointer.split('/').filter(Boolean).map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  let path = 'root';
  for (const p of parts) {
    if (/^\d+$/.test(p)) path += `[${p}]`;
    else path += `.${p}`;
  }
  return path;
}
