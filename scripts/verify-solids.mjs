/**
 * Does each net actually close into the solid it claims to be?
 *
 * Folded fully, the free edges have to meet in pairs. If they do, every edge
 * belongs to exactly two faces, the deduped vertices are the solid's real
 * vertices, and Euler's V - E + F = 2 comes out on its own.
 */
import { SOLIDS, foldNet } from "../src/solids.js";

const TOL = 1e-6;

function key(p) {
  return p.map((v) => (Math.abs(v) < TOL ? 0 : v).toFixed(6)).join(",");
}

let bad = 0;
for (const spec of SOLIDS) {
  const folded = foldNet(spec, 1);
  const verts = new Map();
  const idOf = (p) => {
    const k = key(p);
    if (!verts.has(k)) verts.set(k, verts.size);
    return verts.get(k);
  };

  const edgeUse = new Map();
  for (const f of folded) {
    const ids = f.pts.map(idOf);
    for (let i = 0; i < ids.length; i++) {
      const a = ids[i];
      const b = ids[(i + 1) % ids.length];
      const ek = a < b ? `${a}-${b}` : `${b}-${a}`;
      edgeUse.set(ek, (edgeUse.get(ek) || 0) + 1);
    }
  }

  const V = verts.size;
  const E = edgeUse.size;
  const F = folded.length;
  const open = [...edgeUse.values()].filter((n) => n !== 2).length;
  const euler = V - E + F;
  const want = spec.counts;
  const ok = V === want.v && E === want.e && F === want.f && open === 0 && euler === 2;
  if (!ok) bad++;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${spec.label.padEnd(6)} V=${V}(${want.v}) E=${E}(${want.e}) F=${F}(${want.f}) ` +
      `V-E+F=${euler} 非共有の辺=${open}`
  );

  // faces must stay flat and rigid: edge lengths preserved from the net
  for (let i = 0; i < spec.faces.length; i++) {
    const flat = spec.faces[i].poly;
    const solid = folded[i].pts;
    for (let j = 0; j < flat.length; j++) {
      const k = (j + 1) % flat.length;
      const d0 = Math.hypot(flat[k][0] - flat[j][0], flat[k][1] - flat[j][1]);
      const d1 = Math.hypot(
        solid[k][0] - solid[j][0],
        solid[k][1] - solid[j][1],
        solid[k][2] - solid[j][2]
      );
      if (Math.abs(d0 - d1) > TOL) {
        console.log(`     FAIL 面${i} の辺${j} が伸縮: ${d0} -> ${d1}`);
        bad++;
      }
    }
  }
}
console.log(bad === 0 ? "\nすべての展開図が閉じました。" : `\n${bad} 件の不整合`);
process.exit(bad === 0 ? 0 : 1);
