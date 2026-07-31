// Line-level diff between two raw texts, for painting highlights directly onto
// the A/B editors. This is textual (works even while one side is mid-edit and
// not yet valid JSON) — complementary to the semantic tree diff in diff.js.
//
// Returns per-line status maps (1-based line → 'add' | 'del' | 'chg') plus
// counts. A delete immediately followed by an insert is treated as an in-place
// change so an edited line lights up amber on both sides instead of red+green.
export function lineDiff(aText, bText) {
  const a = aText.split('\n');
  const b = bText.split('\n');
  const n = a.length, m = b.length;

  // LCS table on exact line equality
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);

  const ops = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ t: 'same', i, j }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ t: 'del', i }); i++; }
    else { ops.push({ t: 'ins', j }); j++; }
  }
  while (i < n) { ops.push({ t: 'del', i }); i++; }
  while (j < m) { ops.push({ t: 'ins', j }); j++; }

  const aStatus = new Map();
  const bStatus = new Map();
  for (let k = 0; k < ops.length; k++) {
    const o = ops[k], nx = ops[k + 1];
    if (o.t === 'del' && nx && nx.t === 'ins') { aStatus.set(o.i + 1, 'chg'); bStatus.set(nx.j + 1, 'chg'); k++; }
    else if (o.t === 'del') aStatus.set(o.i + 1, 'del');
    else if (o.t === 'ins') bStatus.set(o.j + 1, 'add');
  }

  let removed = 0, changed = 0, added = 0;
  for (const v of aStatus.values()) { if (v === 'del') removed++; else changed++; }
  for (const v of bStatus.values()) if (v === 'add') added++;

  return { aStatus, bStatus, counts: { added, removed, changed } };
}
