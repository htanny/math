/**
 * Runs every checker in scripts/ and reports which ones passed.
 *
 * Each checker exits non-zero on a mismatch, so this is `npm test`: one
 * command that has to come back green before anything ships.
 */
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const dir = fileURLToPath(new URL(".", import.meta.url));
const scripts = readdirSync(dir)
  .filter((f) => f.startsWith("verify-") && f.endsWith(".mjs") && f !== "verify-all.mjs")
  .sort();

const failed = [];
for (const name of scripts) {
  const started = Date.now();
  console.log(`\n${"=".repeat(64)}\n${name}\n${"=".repeat(64)}`);
  const res = spawnSync(process.execPath, [join(dir, name)], { stdio: "inherit" });
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (res.status !== 0) {
    failed.push(name);
    console.log(`--- ${name}: 失敗 (${secs}s)`);
  } else {
    console.log(`--- ${name}: OK (${secs}s)`);
  }
}

console.log(`\n${"=".repeat(64)}`);
if (failed.length === 0) {
  console.log(`${scripts.length} 件の検証すべてに合格しました。`);
} else {
  console.log(`${failed.length} / ${scripts.length} 件が失敗: ${failed.join(", ")}`);
}
process.exit(failed.length === 0 ? 0 : 1);
